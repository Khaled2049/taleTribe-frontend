/** Firebase Functions for BYOK AI provider settings management. */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { requireAuth } from "../infra/authService";
import {
  setUserAiSettings,
  deleteUserAiSettings,
  validateProviderKey,
  corsWithEncryption,
} from "../domain/aiSettings";
import { corsOptions } from "../infra/corsConfig";

const VALID_PROVIDERS = ["gemini", "claude", "openai"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

/**
 * POST /saveAiSettings
 * Store encrypted BYOK API key for the authenticated user.
 * Body: { provider: "gemini"|"claude"|"openai", apiKey: string, model?: string }
 */
export const saveAiSettings = onRequest(
  corsWithEncryption,
  requireAuth(async (request, response, userId) => {
    try {
      const { provider, apiKey, model } = request.body as {
        provider?: string;
        apiKey?: string;
        model?: string;
      };

      if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
        response.status(400).json({
          error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}`,
        });
        return;
      }

      if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
        response.status(400).json({ error: "apiKey is required" });
        return;
      }

      await setUserAiSettings(userId, provider as Provider, apiKey.trim(), model?.trim());

      logger.info("AI settings saved", { userId, provider });
      response.status(200).json({ success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const code = (error as any)?.code ?? undefined;
      logger.error("Error saving AI settings", { userId: "redacted", msg, code });
      const detail = process.env.FUNCTIONS_EMULATOR === "true" ? `${code ?? ""}: ${msg}` : undefined;
      response.status(500).json({ error: "Failed to save AI settings", detail });
    }
  }),
);

/**
 * POST /deleteAiSettings
 * Remove BYOK settings and revert user to platform default quota.
 */
export const deleteAiSettings = onRequest(
  corsOptions,
  requireAuth(async (_request, response, userId) => {
    try {
      await deleteUserAiSettings(userId);
      logger.info("AI settings deleted", { userId });
      response.status(200).json({ success: true });
    } catch (error) {
      logger.error("Error deleting AI settings", { userId, error });
      response.status(500).json({ error: "Failed to delete AI settings" });
    }
  }),
);

/**
 * POST /validateAiKey
 * Test that a provider API key is valid before saving.
 * Body: { provider: "gemini"|"claude"|"openai", apiKey: string }
 * Response: { valid: boolean, error?: string }
 */
export const validateAiKey = onRequest(
  corsOptions,
  requireAuth(async (request, response, _userId) => {
    try {
      const { provider, apiKey } = request.body as {
        provider?: string;
        apiKey?: string;
      };

      if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
        response.status(400).json({
          error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}`,
        });
        return;
      }

      if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
        response.status(400).json({ error: "apiKey is required" });
        return;
      }

      const result = await validateProviderKey(provider as Provider, apiKey.trim());
      response.status(200).json(result);
    } catch (error) {
      logger.error("Error validating AI key", error);
      response.status(500).json({ valid: false, error: "Validation failed" });
    }
  }),
);
