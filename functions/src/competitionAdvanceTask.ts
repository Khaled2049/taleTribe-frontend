/**
 * Scheduled phase advance.
 *
 * The task is advisory. It re-reads the competition and lets `ensurePhase`
 * decide, so it is safe if the deadline moved, if the competition was already
 * advanced by a lazy touch, or if it was cancelled entirely. A stale task
 * simply finds nothing to do.
 *
 * Errors that are the competition's fault (deleted, already terminal) are
 * swallowed rather than thrown: throwing would make Cloud Tasks retry work that
 * can never succeed. Only genuinely transient failures are allowed to escape so
 * the retry policy applies.
 */
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { AdvanceTaskPayload, ensurePhase } from "./competitionLifecycle";
import { settleCompetition } from "./competitionSettlement";

const db = admin.firestore();

export const competitionAdvanceTask = onTaskDispatched(
  {
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 5 },
    rateLimits: { maxConcurrentDispatches: 5 },
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    const { competitionId, targetPhase, expectedAtMs } =
      request.data as AdvanceTaskPayload;

    if (!competitionId) {
      logger.warn("competitionAdvanceTask: missing competitionId");
      return;
    }

    try {
      const snapshot = await db
        .collection("competitions")
        .doc(competitionId)
        .get();

      if (!snapshot.exists) {
        logger.info("competitionAdvanceTask: competition gone, ignoring", {
          competitionId,
        });
        return;
      }

      const data = snapshot.data() ?? {};

      // The deadline this task was scheduled against has since changed, so a
      // newer task is already queued for the new time. Do nothing.
      const currentTarget =
        targetPhase === "open"
          ? data.startDate?.toMillis?.()
          : targetPhase === "settled"
            ? data.votingDeadline?.toMillis?.()
            : data.deadline?.toMillis?.();

      if (
        typeof currentTarget === "number" &&
        typeof expectedAtMs === "number" &&
        currentTarget !== expectedAtMs
      ) {
        logger.info("competitionAdvanceTask: schedule moved, ignoring", {
          competitionId,
          targetPhase,
          expectedAtMs,
          currentTarget,
        });
        return;
      }

      // Settlement is not a clock-driven phase move — it ranks entries and
      // moves money — so it goes through settleCompetition, which claims
      // `settling` first and is safe to re-run.
      if (targetPhase === "settled") {
        const outcome = await settleCompetition(db, competitionId);
        logger.info("competitionAdvanceTask: settled", {
          competitionId,
          settledNow: outcome.settledNow,
          refunded: outcome.refunded,
        });
        return;
      }

      const { phase, changed } = await ensurePhase(db, competitionId);
      logger.info("competitionAdvanceTask: evaluated", {
        competitionId,
        targetPhase,
        phase,
        changed,
      });
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404) {
        // Deterministic failure — retrying cannot help.
        logger.info("competitionAdvanceTask: not found, ignoring", {
          competitionId,
        });
        return;
      }
      logger.error("competitionAdvanceTask failed", { competitionId, error });
      throw error;
    }
  },
);
