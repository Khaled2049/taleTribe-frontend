/** Admin control to turn one member's AI off and back on. */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireAdmin } from "../infra/authService";
import { corsOptions } from "../infra/corsConfig";
import { AI_SUSPENSIONS, parseSuspensionChange } from "../domain/aiSuspension";

/**
 * POST /setAiSuspension { uid, suspended, scope?, reason? }. It applies on the
 * member's next AI request, with no sign-out. An admin cannot suspend themselves.
 */
const handleSetAiSuspension = requireAdmin(async (request, response, actorId) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const change = parseSuspensionChange(request.body);
  if (!change) {
    response.status(400).json({
      error: "uid and a boolean suspended are required; suspending needs scope platform or all and a reason of at most 500 characters",
    });
    return;
  }
  if (change.uid === actorId) {
    response.status(409).json({ error: "You cannot suspend your own AI access" });
    return;
  }
  try {
    try {
      await getAuth().getUser(change.uid);
    } catch {
      response.status(404).json({ error: "user not found" });
      return;
    }
    const db = getFirestore();
    const ref = db.collection(AI_SUSPENSIONS).doc(change.uid);
    const audit = db.collection("aiSuspensionChanges").doc();
    const batch = db.batch();
    if (change.suspended) {
      batch.set(ref, {
        scope: change.scope,
        reason: change.reason,
        suspendedBy: actorId,
        suspendedAt: FieldValue.serverTimestamp(),
      });
    } else {
      batch.delete(ref);
    }
    batch.set(audit, { actorId, targetId: change.uid, ...change, at: FieldValue.serverTimestamp() });
    await batch.commit();
    logger.info("AI suspension changed", {
      actorId,
      targetId: change.uid,
      suspended: change.suspended,
      scope: change.suspended ? change.scope : null,
    });
    response.status(200).json({ uid: change.uid, suspended: change.suspended });
  } catch (error) {
    logger.error("Failed to change AI suspension", { actorId, targetId: change.uid, error });
    response.status(500).json({ error: "Failed to change AI suspension" });
  }
});

export const setAiSuspension = onRequest(corsOptions, handleSetAiSuspension);
