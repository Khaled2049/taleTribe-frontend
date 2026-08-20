/** AI enhancement for the co-write wizard (pre-story creation, auth-only). */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireAuth } from "../infra/authService";
import { callAgentWithRetry } from "../agent/retry";
import { checkAiAccess, corsWithEncryption } from "../domain/aiSettings";

const VALID_TYPES = ["premise", "character", "place", "conflict", "blueprint"] as const;
type WizardEnhanceType = (typeof VALID_TYPES)[number];

/**
 * POST /enhanceWizardInput
 *
 * Enhances user inputs in the "Start with AI" wizard before a story exists.
 * Requires Firebase auth but NOT story ownership — the story hasn't been
 * created yet at this point in the flow.
 */
export const enhanceWizardInput = onRequest(
  corsWithEncryption,
  requireAuth(async (request, response, userId, idToken) => {
    try {
      // ── Quota check (bypassed for BYOK users) ─────────────────────────────
      const access = await checkAiAccess(userId);
      if (!access.allowed) {
        response.status(429).json({
          error: access.reason || "Daily AI quota exceeded",
        });
        return;
      }
      // ── Validate request ───────────────────────────────────────────────────
      const { type, data } = request.body as {
        type?: string;
        data?: Record<string, unknown>;
      };

      if (!type || !VALID_TYPES.includes(type as WizardEnhanceType)) {
        response.status(400).json({
          error: `type must be one of: ${VALID_TYPES.join(", ")}`,
        });
        return;
      }

      if (!data || typeof data !== "object") {
        response.status(400).json({ error: "data object is required" });
        return;
      }

      // ── Call agent ─────────────────────────────────────────────────────────
      const agentResponse = await callAgentWithRetry("enhanceWizardInput", {
        type,
        data,
        userId,
      }, 3, 1000, userId, access.providerConfig ?? undefined, idToken);

      if (!agentResponse.success || !agentResponse.data) {
        response.status(500).json({
          error: agentResponse.error || "Failed to enhance input",
          details: agentResponse.error,
        });
        return;
      }

      response.status(200).json(agentResponse.data);
    } catch (error) {
      logger.error("Error in enhanceWizardInput", error);
      response.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }),
);
