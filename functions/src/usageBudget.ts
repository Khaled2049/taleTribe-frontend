/**
 * Per-user daily usage budgets, backed by a transactional counter on the user doc.
 *
 * One generic helper drives every budget so they share the same atomic
 * read-modify-write and fail-closed semantics. Used for the AI quota
 * (chat/generation) — see consumePlatformDailyQuota in aiSettings.ts.
 *
 * The indexing budget left with the Firestore write triggers; embedding is now
 * metered by the agents' outbox consumer against `indexing_usage` in story-data.
 *
 * Each budget stores a usage count + the date it applies to on `users/{uid}`; the
 * count resets the first time it is consumed on a new UTC day.
 */
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

interface DailyBudgetSpec {
  /** Numeric usage field on the user doc, e.g. "aiUsage". */
  usageField: string;
  /** ISO date (YYYY-MM-DD) field paired with usageField, e.g. "lastAiUsageDate". */
  dateField: string;
  /** Inclusive daily ceiling. */
  limit: number;
}

/**
 * Atomically consume one unit of a daily budget for a user. Returns true if the
 * unit was granted (and recorded), false if the user is already at the limit.
 *
 * Fails CLOSED: if the transaction errors (e.g. Firestore unavailable) we return
 * false so an outage can't hand out unlimited paid work.
 */
export async function consumeDailyBudget(
  userId: string,
  spec: DailyBudgetSpec,
): Promise<boolean> {
  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);
  const today = new Date().toISOString().split("T")[0];

  try {
    return await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const data = userSnap.data() || {};
      const lastDate =
        typeof data[spec.dateField] === "string" ? data[spec.dateField] : "";
      const priorUsage =
        typeof data[spec.usageField] === "number" ? data[spec.usageField] : 0;
      const todayUsage = lastDate === today ? priorUsage : 0;

      if (todayUsage >= spec.limit) {
        return false;
      }

      tx.set(
        userRef,
        {
          [spec.usageField]: todayUsage + 1,
          [spec.dateField]: today,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    });
  } catch (error) {
    logger.error("consumeDailyBudget failed", {
      userId,
      usageField: spec.usageField,
      error,
    });
    return false;
  }
}

