/** Admin review of Claude connector (MCP) access: list records and grant, reject or revoke. */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { requireAdmin } from "../infra/authService";
import { corsOptions } from "../infra/corsConfig";
import {
  MCP_PAGE_SIZE,
  displayNote,
  isMcpStatus,
  nextMcpStatus,
  parseMcpReview,
} from "../domain/mcpAccess";

const iso = (value: unknown) => (value instanceof Timestamp ? value.toDate().toISOString() : null);

// Emails come from Auth by uid, never from the record: users write their own
// request, so anything in it is self-reported.
async function emails(uids: string[]) {
  if (!uids.length) return new Map<string, string>();
  const { users } = await getAuth().getUsers(uids.map((uid) => ({ uid })));
  return new Map(users.map((user) => [user.uid, user.email ?? ""]));
}

function toRecord(uid: string, data: FirebaseFirestore.DocumentData, email: string | undefined) {
  return {
    uid,
    email: email ?? null,
    status: data.status,
    note: displayNote(data.note),
    requestedAt: iso(data.requestedAt),
    decidedAt: iso(data.decidedAt),
    decidedBy: typeof data.decidedBy === "string" ? data.decidedBy : null,
  };
}

/** GET /listMcpAccess?status=requested&cursor=<uid>. Omit status for every record. */
const handleListMcpAccess = requireAdmin(async (request, response) => {
  if (request.method !== "GET") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const status = typeof request.query.status === "string" ? request.query.status : "";
  const cursor = typeof request.query.cursor === "string" ? request.query.cursor : "";
  if (status && !isMcpStatus(status)) {
    response.status(400).json({ error: "unknown status" });
    return;
  }
  try {
    const collection = getFirestore().collection("mcpAccess");
    let query = (status ? collection.where("status", "==", status) : collection)
      .orderBy("requestedAt", "desc")
      .limit(MCP_PAGE_SIZE + 1);
    if (cursor) {
      const after = await collection.doc(cursor).get();
      if (!after.exists) {
        response.status(400).json({ error: "invalid cursor" });
        return;
      }
      query = query.startAfter(after);
    }
    const docs = (await query.get()).docs;
    const page = docs.slice(0, MCP_PAGE_SIZE);
    const emailByUid = await emails(page.map((doc) => doc.id));
    response.set("Cache-Control", "no-store").status(200).json({
      records: page.map((doc) => toRecord(doc.id, doc.data(), emailByUid.get(doc.id))),
      nextCursor: docs.length > MCP_PAGE_SIZE ? page[page.length - 1].id : null,
    });
  } catch (error) {
    logger.error("Failed to list MCP access", { status, error });
    response.status(500).json({ error: "Failed to list MCP access" });
  }
});

/** POST /reviewMcpAccess { uid, decision: "grant" | "reject" | "revoke" } */
const handleReviewMcpAccess = requireAdmin(async (request, response, adminId) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const review = parseMcpReview(request.body);
  if (!review) {
    response.status(400).json({ error: "uid and a decision of grant, reject or revoke are required" });
    return;
  }
  const ref = getFirestore().collection("mcpAccess").doc(review.uid);
  try {
    // A transaction, so two admins acting at once cannot both apply a decision
    // to a record the other has already changed.
    const outcome = await getFirestore().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) return { code: 404 as const };
      const current = snapshot.get("status");
      const next = nextMcpStatus(current, review.decision);
      if (!next) return { code: 409 as const, current };
      tx.update(ref, { status: next, decidedAt: FieldValue.serverTimestamp(), decidedBy: adminId });
      return { code: 200 as const, next };
    });
    if (outcome.code === 404) {
      response.status(404).json({ error: "No MCP access record for this user" });
      return;
    }
    if (outcome.code === 409) {
      response.status(409).json({ error: `Cannot ${review.decision} a record that is ${outcome.current}` });
      return;
    }
    logger.info("MCP access reviewed", { adminId, targetId: review.uid, status: outcome.next });
    const [snapshot, emailByUid] = await Promise.all([ref.get(), emails([review.uid])]);
    response.status(200).json(toRecord(review.uid, snapshot.data() ?? {}, emailByUid.get(review.uid)));
  } catch (error) {
    logger.error("Failed to review MCP access", { targetId: review.uid, error });
    response.status(500).json({ error: "Failed to review MCP access" });
  }
});

export const listMcpAccess = onRequest(corsOptions, handleListMcpAccess);
export const reviewMcpAccess = onRequest(corsOptions, handleReviewMcpAccess);
