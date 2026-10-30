/** Admin management of the `admin` custom claim, plus a batched lookup for the members table. */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { requireAdmin } from "../infra/authService";
import { corsOptions } from "../infra/corsConfig";
import { parseRoleChange, parseRoleLookup, withAdminClaim } from "../domain/adminRoles";

/** POST /adminRoles { uids } → { admins, banned } — who holds the claim and whose account is disabled. */
const handleAdminRoles = requireAdmin(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const uids = parseRoleLookup(request.body);
  if (!uids) {
    response.status(400).json({ error: "uids must be an array of at most 50 user IDs" });
    return;
  }
  try {
    const { users } = uids.length ? await getAuth().getUsers(uids.map((uid) => ({ uid }))) : { users: [] };
    response.set("Cache-Control", "no-store").status(200).json({
      admins: users.filter((user) => user.customClaims?.admin === true).map((user) => user.uid),
      banned: users.filter((user) => user.disabled).map((user) => user.uid),
    });
  } catch (error) {
    logger.error("Failed to look up admin roles", { error });
    response.status(500).json({ error: "Failed to look up admin roles" });
  }
});

/**
 * POST /setAdminRole { uid, admin }. An admin cannot change their own role, so
 * the last admin can never be removed. Removal revokes the user's sessions,
 * which ends admin access at once because admin routes check revocation.
 */
const handleSetAdminRole = requireAdmin(async (request, response, actorId) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const change = parseRoleChange(request.body);
  if (!change) {
    response.status(400).json({ error: "uid and a boolean admin are required" });
    return;
  }
  if (change.uid === actorId) {
    response.status(409).json({ error: "You cannot change your own admin role" });
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
    const wasAdmin = target.customClaims?.admin === true;
    if (wasAdmin !== change.admin) {
      await getAuth().setCustomUserClaims(change.uid, withAdminClaim(target.customClaims, change.admin));
      if (!change.admin) await getAuth().revokeRefreshTokens(change.uid);
      await getFirestore().collection("adminRoleChanges").add({
        actorId,
        targetId: change.uid,
        admin: change.admin,
        at: FieldValue.serverTimestamp(),
      });
      logger.info("Admin role changed", { actorId, targetId: change.uid, admin: change.admin });
    }
    response.status(200).json({ uid: change.uid, admin: change.admin });
  } catch (error) {
    logger.error("Failed to change admin role", { actorId, targetId: change.uid, error });
    response.status(500).json({ error: "Failed to change admin role" });
  }
});

export const adminRoles = onRequest(corsOptions, handleAdminRoles);
export const setAdminRole = onRequest(corsOptions, handleSetAdminRole);
