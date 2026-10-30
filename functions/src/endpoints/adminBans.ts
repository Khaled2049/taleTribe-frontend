/** Admin ban of a member from the whole platform, and lifting it. */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireAdmin } from "../infra/authService";
import { corsOptions } from "../infra/corsConfig";
import { parseBanChange } from "../domain/adminRoles";

const storyDataURL = () => (process.env.STORY_DATA_URL || "http://localhost:8084").replace(/\/$/, "");

/** story-data refuses a banned member's ID token at once; Auth alone would honour it for up to an hour. */
async function setStoryDataBan(uid: string, banned: boolean, reason: string | null, adminId: string, idToken: string) {
  const response = await fetch(`${storyDataURL()}/v1/admin/members/${encodeURIComponent(uid)}/ban`, {
    method: banned ? "PUT" : "DELETE",
    // X-User-ID and X-Admin are honoured by story-data AUTH_MODE=dev only.
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}`, "X-User-ID": adminId, "X-Admin": "true" },
    ...(banned ? { body: JSON.stringify({ reason: reason ?? "" }) } : {}),
  });
  if (!response.ok) throw new Error(`story-data ban request failed (${response.status})`);
}

/**
 * POST /setUserBan { uid, banned, reason? }. Banning records it in story-data,
 * disables the Firebase account and revokes its sessions; lifting reverses all
 * three. Admins cannot be banned, so remove the role first. Retrying is safe.
 */
const handleSetUserBan = requireAdmin(async (request, response, actorId, idToken) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const change = parseBanChange(request.body);
  if (!change) {
    response.status(400).json({ error: "uid and a boolean banned are required; the reason is at most 500 characters" });
    return;
  }
  if (change.uid === actorId) {
    response.status(409).json({ error: "You cannot ban yourself" });
    return;
  }
  try {
    let target;
    try {
      target = await getAuth().getUser(change.uid);
    } catch {
      response.status(404).json({ error: "user not found" });
      return;
    }
    if (change.banned && target.customClaims?.admin === true) {
      response.status(409).json({ error: "Remove their admin role before banning them" });
      return;
    }
    if (change.banned) {
      await setStoryDataBan(change.uid, true, change.reason, actorId, idToken);
      await getAuth().updateUser(change.uid, { disabled: true });
      await getAuth().revokeRefreshTokens(change.uid);
    } else {
      await getAuth().updateUser(change.uid, { disabled: false });
      await setStoryDataBan(change.uid, false, null, actorId, idToken);
    }
    await getFirestore().collection("userBanChanges").add({
      actorId,
      targetId: change.uid,
      banned: change.banned,
      reason: change.banned ? change.reason : null,
      at: FieldValue.serverTimestamp(),
    });
    logger.info("User ban changed", { actorId, targetId: change.uid, banned: change.banned });
    response.status(200).json({ uid: change.uid, banned: change.banned });
  } catch (error) {
    logger.error("Failed to change user ban", { actorId, targetId: change.uid, error });
    response.status(500).json({ error: "Failed to change the ban. Try again; it is safe to repeat." });
  }
});

export const setUserBan = onRequest(corsOptions, handleSetUserBan);
