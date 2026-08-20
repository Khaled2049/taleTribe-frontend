/** Per-user daily Storage upload quota (Firestore-backed). */
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

/** Must match `dailyStorageUploadLimit()` in root storage.rules */
export const DEFAULT_DAILY_STORAGE_UPLOAD_LIMIT = 50;

export function getUtcDayKey(date = new Date()): string {
  return date.toISOString().split("T")[0];
}

function getDailyStorageUploadLimit(): number {
  const raw = process.env.MAX_STORAGE_UPLOADS_PER_DAY || String(DEFAULT_DAILY_STORAGE_UPLOAD_LIMIT);
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_STORAGE_UPLOAD_LIMIT;
  }
  return parsed;
}

export interface ReserveStorageUploadResult {
  allowed: boolean;
  count?: number;
  limit?: number;
  reason?: string;
}

/**
 * Atomically reserve one upload slot for the current UTC day.
 * Clients must call this before each Storage write; storage.rules enforces count >= 1.
 */
export async function reserveUserStorageUpload(
  userId: string,
): Promise<ReserveStorageUploadResult> {
  const db = getFirestore();
  const dayKey = getUtcDayKey();
  const limit = getDailyStorageUploadLimit();
  const quotaRef = db
    .collection("users")
    .doc(userId)
    .collection("_storageQuota")
    .doc(dayKey);

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(quotaRef);
      const current =
        snap.exists && typeof snap.data()?.count === "number"
          ? snap.data()!.count
          : 0;

      if (current >= limit) {
        return {
          allowed: false,
          limit,
          reason: `Daily upload limit (${limit}) reached. Try again tomorrow.`,
        };
      }

      const next = current + 1;
      tx.set(
        quotaRef,
        {
          count: next,
          dayKey,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return { allowed: true, count: next, limit };
    });
  } catch (error) {
    logger.error("reserveUserStorageUpload failed", { userId, error });
    return {
      allowed: false,
      reason: "Unable to verify upload quota. Please try again.",
    };
  }
}
