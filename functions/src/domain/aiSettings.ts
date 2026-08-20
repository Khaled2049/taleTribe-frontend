/** AI provider settings — encryption, Firestore helpers, BYOK access check. */
import * as crypto from "crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { corsOptions } from "../infra/corsConfig";
import { consumeDailyBudget } from "../infra/usageBudget";

export const encryptionKey = defineSecret("ENCRYPTION_KEY");

/**
 * Max concurrent function instances for AI endpoints. Caps how far a request
 * flood can fan out compute (and, downstream, paid LLM calls), bounding
 * worst-case cost. Override with AI_MAX_INSTANCES.
 */
function getAiMaxInstances(): number {
  const parsed = Number.parseInt(process.env.AI_MAX_INSTANCES || "10", 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 10;
  return parsed;
}

/** onRequest options for endpoints that encrypt/decrypt BYOK API keys. */
export const corsWithEncryption = {
  ...corsOptions,
  secrets: [encryptionKey],
  maxInstances: getAiMaxInstances(),
};

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32;

export interface ProviderConfig {
  provider: "gemini" | "claude" | "openai";
  api_key: string;
  model?: string;
}

export interface AiAccessResult {
  allowed: boolean;
  byok: boolean;
  providerConfig: ProviderConfig | null;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const secret = encryptionKey.value();
  if (!secret) {
    if (process.env.FUNCTIONS_EMULATOR === "true") {
      // Deterministic dev key — never used in production
      return crypto.scryptSync("dev-key-local-only", "novelsync-salt", KEY_LEN);
    }
    throw new Error("ENCRYPTION_KEY secret required in production");
  }
  return crypto.scryptSync(secret, "novelsync-ai-settings", KEY_LEN);
}

function encryptApiKey(plaintext: string): {
  ciphertext: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptApiKey(
  ciphertext: string,
  iv: string,
  authTag: string,
): string {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64"),
  ) as crypto.DecipherGCM;
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

export async function getUserAiSettings(
  uid: string,
): Promise<ProviderConfig | null> {
  try {
    const db = getFirestore();
    const doc = await db.collection("users").doc(uid).get();
    const settings = doc.data()?.aiSettings;
    if (!settings?.encryptedApiKey) return null;

    const apiKey = decryptApiKey(
      settings.encryptedApiKey,
      settings.iv,
      settings.authTag,
    );
    return {
      provider: settings.provider,
      api_key: apiKey,
      model: settings.model || undefined,
    };
  } catch (error) {
    logger.error("getUserAiSettings failed", { uid, error });
    return null;
  }
}

export async function setUserAiSettings(
  uid: string,
  provider: "gemini" | "claude" | "openai",
  apiKey: string,
  model?: string,
): Promise<void> {
  const { ciphertext, iv, authTag } = encryptApiKey(apiKey);
  const db = getFirestore();
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        aiSettings: {
          provider,
          encryptedApiKey: ciphertext,
          iv,
          authTag,
          model: model || null,
          createdAt: FieldValue.serverTimestamp(),
        },
        hasCustomAiProvider: true,
      },
      { merge: true },
    );
}

export async function deleteUserAiSettings(uid: string): Promise<void> {
  const db = getFirestore();
  await db.collection("users").doc(uid).update({
    aiSettings: FieldValue.delete(),
    hasCustomAiProvider: false,
  });
}

// ---------------------------------------------------------------------------
// Validate API key by making a minimal test call
// ---------------------------------------------------------------------------

export async function validateProviderKey(
  provider: "gemini" | "claude" | "openai",
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (provider === "gemini") {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      );
      if (!resp.ok) {
        const body = await resp.text();
        return {
          valid: false,
          error: `Gemini: ${resp.status} ${body.slice(0, 200)}`,
        };
      }
      return { valid: true };
    }

    if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) {
        const body = await resp.text();
        return {
          valid: false,
          error: `OpenAI: ${resp.status} ${body.slice(0, 200)}`,
        };
      }
      return { valid: true };
    }

    if (provider === "claude") {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        return {
          valid: false,
          error: `Claude: ${resp.status} ${body.slice(0, 200)}`,
        };
      }
      return { valid: true };
    }

    return { valid: false, error: `Unknown provider: ${provider}` };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

// ---------------------------------------------------------------------------
// Combined access check
// ---------------------------------------------------------------------------

/**
 * Check if user can use AI. BYOK users always pass; others go through quota.
 * Returns providerConfig (non-null for BYOK) to pass to callAgentWithRetry.
 */
export async function checkAiAccess(userId: string): Promise<AiAccessResult> {
  const settings = await getUserAiSettings(userId);

  if (settings) {
    return { allowed: true, byok: true, providerConfig: settings };
  }

  const allowed = await consumePlatformDailyQuota(userId);
  if (!allowed) {
    return {
      allowed: false,
      byok: false,
      providerConfig: null,
      reason:
        "Daily AI quota exceeded. Add your own API key in Settings to continue.",
    };
  }

  return { allowed: true, byok: false, providerConfig: null };
}

function getDailyAiQuotaLimit(): number {
  const raw = process.env.MAX_AI_USAGE || "100";
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 100;
  return parsed;
}

async function consumePlatformDailyQuota(userId: string): Promise<boolean> {
  // Shares the transactional, fail-closed daily counter with the indexing budget.
  return consumeDailyBudget(userId, {
    usageField: "aiUsage",
    dateField: "lastAiUsageDate",
    limit: getDailyAiQuotaLimit(),
  });
}
