/** Firebase Functions for AI credit balance display and top-up (MVP). */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireAuth } from "./authService";
import { callAgentPath } from "./agentService";
import { corsMiddlewareWithMaxAge } from "./corsConfig";

// Allowed top-up amounts. Validated here AND in the Python agent service so a
// crafted request can't mint an arbitrary balance. Keep in sync with
// ALLOWED_CREDIT_TIERS in taleTribe-agents/server.py.
const ALLOWED_CREDIT_TIERS = new Set([10000, 50000, 100000]);

/** Pull `available_credits` out of the agent's `{success,data,error}` envelope. */
function extractBalance(envelope: unknown): number {
  const data = (envelope as { data?: { available_credits?: unknown } })?.data;
  const credits = data?.available_credits;
  return typeof credits === "number" ? credits : 0;
}

/**
 * GET /getCreditBalance
 * Returns the authenticated user's platform AI credit balance.
 * Response: { availableCredits: number }
 */
const handleGetCreditBalance = requireAuth(async (_request, response, userId, idToken) => {
  try {
    const result = await callAgentPath(
      "/credits/balance",
      { user_id: userId },
      idToken,
    );
    if (!result.success) {
      logger.error("Credit balance lookup failed", {
        userId,
        error: result.error,
        errorCode: result.errorCode,
      });
      response.status(502).json({ error: "Failed to fetch credit balance" });
      return;
    }
    response.status(200).json({ availableCredits: extractBalance(result.data) });
  } catch (error) {
    logger.error("Error fetching credit balance", { userId, error });
    response.status(500).json({ error: "Failed to fetch credit balance" });
  }
});

export const getCreditBalance = onRequest({ invoker: "public" }, (request, response) => {
  corsMiddlewareWithMaxAge(request, response, () => handleGetCreditBalance(request, response));
});

/**
 * POST /purchaseCredits
 * Top up the authenticated user's credit balance by an allowed tier (MVP: no
 * payment). Body: { credits: number }. Response: { availableCredits: number }
 */
const handlePurchaseCredits = requireAuth(async (request, response, userId, idToken) => {
  try {
    const { credits } = request.body as { credits?: unknown };

    if (typeof credits !== "number" || !ALLOWED_CREDIT_TIERS.has(credits)) {
      response.status(400).json({
        error: `credits must be one of: ${[...ALLOWED_CREDIT_TIERS].join(", ")}`,
      });
      return;
    }

    const result = await callAgentPath(
      "/credits/purchase",
      { user_id: userId, credits },
      idToken,
    );
    if (!result.success) {
      logger.error("Credit purchase failed", {
        userId,
        credits,
        error: result.error,
        errorCode: result.errorCode,
      });
      // VALIDATION_ERROR = bad amount (client error); RATE_LIMITED = daily
      // purchase cap hit; everything else is an upstream failure.
      let status = 502;
      if (result.errorCode === "VALIDATION_ERROR") {
        status = 400;
      } else if (result.errorCode === "RATE_LIMITED") {
        status = 429;
      }
      response.status(status).json({
        error: result.error ?? "Failed to purchase credits",
      });
      return;
    }

    logger.info("Credits purchased", { userId, credits });
    response.status(200).json({ availableCredits: extractBalance(result.data) });
  } catch (error) {
    logger.error("Error purchasing credits", { userId, error });
    response.status(500).json({ error: "Failed to purchase credits" });
  }
});

export const purchaseCredits = onRequest({ invoker: "public" }, (request, response) => {
  corsMiddlewareWithMaxAge(request, response, () => handlePurchaseCredits(request, response));
});
