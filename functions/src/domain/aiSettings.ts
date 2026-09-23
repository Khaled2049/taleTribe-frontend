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
  provider: "gemini" | "anthropic" | "openai";
  api_key: string;
  model?: string;
}

export interface AiSettingsSummary {
  active: boolean;
  provider: ProviderConfig["provider"] | null;
  model: string | null;
  keyHint: string | null;
  validatedAt: string | null;
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
      provider: canonicalProvider(settings.provider),
      api_key: apiKey,
      model: settings.model || undefined,
    };
  } catch (error) {
    logger.error("getUserAiSettings failed", { uid, error });
    return null;
  }
}

export async function getAiSettingsSummary(
  uid: string,
): Promise<AiSettingsSummary> {
  const db = getFirestore();
  const snapshot = await db.collection("users").doc(uid).get();
  const settings = snapshot.data()?.aiSettings;
  if (!settings?.encryptedApiKey) {
    return {
      active: false,
      provider: null,
      model: null,
      keyHint: null,
      validatedAt: null,
    };
  }
  const timestamp = settings.validatedAt;
  return {
    active: true,
    provider: canonicalProvider(settings.provider),
    model: typeof settings.model === "string" && settings.model ? settings.model : null,
    keyHint: typeof settings.keyHint === "string" ? settings.keyHint : null,
    validatedAt:
      timestamp && typeof timestamp.toDate === "function"
        ? timestamp.toDate().toISOString()
        : null,
  };
}

export function canonicalProvider(
  provider: unknown,
): ProviderConfig["provider"] {
  if (provider === "claude" || provider === "anthropic") return "anthropic";
  if (provider === "openai") return "openai";
  return "gemini";
}

export async function setUserAiSettings(
  uid: string,
  provider: ProviderConfig["provider"],
  apiKey: string,
  model?: string | null,
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
          keyHint: apiKey.slice(-4),
          model: model || null,
          validatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
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
// Combined access check
// ---------------------------------------------------------------------------

/**
 * Check if user can use AI. BYOK users always pass; others go through quota.
 * Returns providerConfig (non-null for BYOK) to pass to callAgentWithRetry.
 */
/**
 * Resolve provider credentials without spending anything.
 *
 * Split out of `checkAiAccess` for callers that must not consume a second unit
 * of daily quota for work already metered — resuming an approved assistant edit
 * is the same turn to the user, and was counted when the run began.
 */
export async function describeAiAccess(userId: string): Promise<AiAccessResult> {
  const settings = await getUserAiSettings(userId);
  return settings
    ? { allowed: true, byok: true, providerConfig: settings }
    : { allowed: true, byok: false, providerConfig: null };
}

export async function checkAiAccess(userId: string): Promise<AiAccessResult> {
  const access = await describeAiAccess(userId);

  // A user on their own key spends no platform quota.
  if (access.byok) {
    return access;
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

  return access;
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
