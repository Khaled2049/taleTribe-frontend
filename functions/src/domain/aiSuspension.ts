/** Admin suspension of one member's AI use, stored in `aiSuspensions/{uid}` (Admin SDK only). */
import { getFirestore } from "firebase-admin/firestore";
import { isUid } from "./aiUsage";

export const AI_SUSPENSIONS = "aiSuspensions";
export const MAX_SUSPENSION_REASON = 500;
export const AI_SUSPENDED_MESSAGE = "AI features are turned off for your account. Contact support if you think this is a mistake.";

/** `platform` stops platform-funded AI only; `all` also stops the member's own key. */
export type AiSuspensionScope = "platform" | "all";

export interface AiSuspension {
  scope: AiSuspensionScope;
  reason: string | null;
  suspendedBy: string | null;
  suspendedAt: string | null;
}

export type SuspensionChange =
  | { uid: string; suspended: true; scope: AiSuspensionScope; reason: string | null }
  | { uid: string; suspended: false };

const isScope = (value: unknown): value is AiSuspensionScope => value === "platform" || value === "all";

export function parseSuspensionChange(body: unknown): SuspensionChange | null {
  const { uid, suspended, scope, reason } = (body ?? {}) as Record<string, unknown>;
  if (!isUid(uid) || typeof suspended !== "boolean") return null;
  if (!suspended) return { uid, suspended };
  if (!isScope(scope)) return null;
  if (reason !== undefined && reason !== null && typeof reason !== "string") return null;
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (trimmed.length > MAX_SUSPENSION_REASON) return null;
  return { uid, suspended, scope, reason: trimmed || null };
}

/** An unrecognised stored scope reads as `all`, so a bad write fails closed. */
export function toSuspension(data: Record<string, unknown> | undefined): AiSuspension | null {
  if (!data) return null;
  const at = data.suspendedAt as { toDate?: () => Date } | undefined;
  return {
    scope: data.scope === "platform" ? "platform" : "all",
    reason: typeof data.reason === "string" ? data.reason : null,
    suspendedBy: typeof data.suspendedBy === "string" ? data.suspendedBy : null,
    suspendedAt: at?.toDate ? at.toDate().toISOString() : null,
  };
}

/** Whether a suspension refuses a request that would run on the member's own key (`byok`) or the platform's. */
export function suspensionBlocks(suspension: AiSuspension | null, byok: boolean): boolean {
  if (!suspension) return false;
  return suspension.scope === "all" || !byok;
}

export async function getAiSuspension(uid: string): Promise<AiSuspension | null> {
  const snapshot = await getFirestore().collection(AI_SUSPENSIONS).doc(uid).get();
  return toSuspension(snapshot.data());
}

export async function getAiSuspensions(uids: string[]): Promise<Map<string, AiSuspension>> {
  if (!uids.length) return new Map();
  const db = getFirestore();
  const docs = await db.getAll(...uids.map((uid) => db.collection(AI_SUSPENSIONS).doc(uid)));
  const found = new Map<string, AiSuspension>();
  for (const doc of docs) {
    const suspension = toSuspension(doc.data());
    if (suspension) found.set(doc.id, suspension);
  }
  return found;
}
