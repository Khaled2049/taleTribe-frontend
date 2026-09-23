/** Firebase Functions for BYOK AI provider settings management. */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { callAgentPath } from "../agent/client";
import { requireAuth } from "../infra/authService";
import {
  canonicalProvider,
  deleteUserAiSettings,
  getAiSettingsSummary,
  getUserAiSettings,
  setUserAiSettings,
  corsWithEncryption,
  type ProviderConfig,
} from "../domain/aiSettings";
import { corsOptions } from "../infra/corsConfig";

const VALID_PROVIDERS = new Set(["gemini", "anthropic", "claude", "openai"]);

interface ValidationResult {
  valid: boolean;
  provider?: ProviderConfig["provider"];
  model?: string;
  error?: string;
}

function agentData<T>(value: unknown): T | null {
  const envelope = value as { success?: boolean; data?: T } | null;
  return envelope?.success === true && envelope.data ? envelope.data : null;
}

function parseProvider(value: unknown): ProviderConfig["provider"] | null {
  if (typeof value !== "string" || !VALID_PROVIDERS.has(value)) return null;
  return canonicalProvider(value);
}

async function validateThroughGateway(
  userId: string,
  idToken: string,
  provider: ProviderConfig["provider"],
  apiKey: string,
  model: string | null,
): Promise<ValidationResult> {
  const result = await callAgentPath(
    "/ai/providers/validate",
    { user_id: userId, provider, api_key: apiKey, model },
    idToken,
  );
  if (!result.success) {
    return { valid: false, error: result.error ?? "Validation service unavailable" };
  }
  return agentData<ValidationResult>(result.data) ?? {
    valid: false,
    error: "Validation service returned an invalid response",
  };
}

/** Return the curated, credential-free provider/model catalog. */
export const getAiProviderCatalog = onRequest(
  corsOptions,
  requireAuth(async (_request, response, _userId, idToken) => {
    const result = await callAgentPath("/ai/providers", {}, idToken);
    const data = result.success ? agentData<unknown>(result.data) : null;
    if (!data) {
      logger.error("AI provider catalog lookup failed", {
        error: result.error,
        errorCode: result.errorCode,
      });
      response.status(502).json({ error: "Failed to fetch AI provider catalog" });
      return;
    }
    response.status(200).json(data);
  }),
);

/** Return saved settings without ever returning the decrypted key. */
export const getAiSettings = onRequest(
  corsOptions,
  requireAuth(async (_request, response, userId) => {
    try {
      response.status(200).json(await getAiSettingsSummary(userId));
    } catch (error) {
      logger.error("AI settings summary failed", { userId, error });
      response.status(500).json({ error: "Failed to fetch AI settings" });
    }
  }),
);

/** Validate and store an encrypted BYOK key and selected model. */
export const saveAiSettings = onRequest(
  corsWithEncryption,
  requireAuth(async (request, response, userId, idToken) => {
    try {
      const body = request.body as {
        provider?: unknown;
        apiKey?: unknown;
        model?: unknown;
      };
      const provider = parseProvider(body.provider);
      if (!provider) {
        response.status(400).json({ error: "Unsupported AI provider" });
        return;
      }
      if (body.model != null && typeof body.model !== "string") {
        response.status(400).json({ error: "model must be a string or null" });
        return;
      }

      const existing = await getUserAiSettings(userId);
      const suppliedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
      const apiKey = suppliedKey || (existing?.provider === provider ? existing.api_key : "");
      if (!apiKey) {
        response.status(400).json({ error: "An API key is required for this provider" });
        return;
      }
      const model = typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : null;
      const validation = await validateThroughGateway(
        userId,
        idToken,
        provider,
        apiKey,
        model,
      );
      if (!validation.valid) {
        response.status(400).json({
          error: validation.error ?? "Provider rejected this key or model",
        });
        return;
      }

      // Persist null as "automatic" so changing the catalog's provider default
      // does not require rewriting every user's settings document.
      await setUserAiSettings(userId, provider, apiKey, model);
      logger.info("AI settings saved", {
        userId,
        provider,
        model: model ?? "automatic",
        validatedModel: validation.model,
      });
      response.status(200).json({ success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Error saving AI settings", { userId: "redacted", msg });
      response.status(500).json({ error: "Failed to save AI settings" });
    }
  }),
);

/** Remove BYOK settings and revert to the platform credit pool. */
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

/** Validate a key/model pair without persisting it. */
export const validateAiKey = onRequest(
  corsWithEncryption,
  requireAuth(async (request, response, userId, idToken) => {
    try {
      const body = request.body as {
        provider?: unknown;
        apiKey?: unknown;
        model?: unknown;
      };
      const provider = parseProvider(body.provider);
      if (!provider) {
        response.status(400).json({ valid: false, error: "Unsupported AI provider" });
        return;
      }
      const existing = await getUserAiSettings(userId);
      const suppliedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
      const apiKey = suppliedKey || (existing?.provider === provider ? existing.api_key : "");
      if (!apiKey) {
        response.status(400).json({ valid: false, error: "An API key is required" });
        return;
      }
      const model = typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : null;
      response.status(200).json(
        await validateThroughGateway(userId, idToken, provider, apiKey, model),
      );
    } catch (error) {
      logger.error("Error validating AI key", { userId: "redacted", error });
      response.status(500).json({ valid: false, error: "Validation failed" });
    }
  }),
);
