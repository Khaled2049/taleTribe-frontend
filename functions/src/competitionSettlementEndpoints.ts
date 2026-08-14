/**
 * The settlement endpoint.
 *
 * Admin-gated: it decides who receives a prize pool and then moves it.
 *
 * Deliberately NOT routed through jobService — `updateJobStatus` is not
 * transactional and has no state guard, so a Cloud Tasks retry could re-run a
 * payout. Idempotency here comes from the `settling` phase claim plus the
 * ledger's create-only transfer document.
 */
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { corsOptions } from "./corsConfig";
import { requireAdmin } from "./authService";
import { settleCompetition } from "./competitionSettlement";

const db = admin.firestore();

export const settleCompetitionEndpoint = onRequest(
  corsOptions,
  requireAdmin(async (request, response, adminUserId) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const competitionId = request.body?.competitionId;
      if (!competitionId || typeof competitionId !== "string") {
        response.status(400).json({ error: "competitionId is required" });
        return;
      }

      const outcome = await settleCompetition(db, competitionId);

      // An already-settled competition returns 200 with its stored results.
      // Settling is retried by tasks and by humans; a retry must not look like
      // a failure.
      response.status(200).json({
        competitionId: outcome.competitionId,
        phase: outcome.phase,
        results: outcome.results,
        resultsDigest: outcome.resultsDigest,
        settledNow: outcome.settledNow,
        refunded: outcome.refunded,
      });
    } catch (error) {
      const statusCode =
        Number((error as { statusCode?: number })?.statusCode) || 500;

      // 500 here means the payout did not complete and the competition is
      // sitting in `settling` — log loudly, it needs a retry.
      if (statusCode >= 500) {
        logger.error("Settlement failed", { adminUserId, error });
      } else {
        logger.info("Settlement rejected", { adminUserId, statusCode });
      }

      response.status(statusCode).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to settle competition",
      });
    }
  }),
);
