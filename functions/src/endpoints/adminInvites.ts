/** Admin review of invite requests: list them and approve or reject one. */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { requireAdmin } from "../infra/authService";
import { corsOptions } from "../infra/corsConfig";
import {
  INVITE_PAGE_SIZE,
  isInviteStatus,
  nextInviteStatus,
  parseReviewRequest,
} from "../domain/inviteReview";

const iso = (value: unknown) => (value instanceof Timestamp ? value.toDate().toISOString() : null);

function toInvite(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    email: typeof data.email === "string" ? data.email : id,
    status: data.status,
    requestedAt: iso(data.requestedAt),
    reviewedAt: iso(data.reviewedAt),
    reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : null,
    sentAt: iso(data.sentAt),
    completedAt: iso(data.completedAt),
    linkSentCount: typeof data.linkSentCount === "number" ? data.linkSentCount : 0,
  };
}

/** GET /listInvites?status=pending&cursor=<email>. Omit status for all invites. */
const handleListInvites = requireAdmin(async (request, response) => {
  if (request.method !== "GET") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const status = typeof request.query.status === "string" ? request.query.status : "";
  const cursor = typeof request.query.cursor === "string" ? request.query.cursor : "";
  if (status && !isInviteStatus(status)) {
    response.status(400).json({ error: "unknown status" });
    return;
  }
  try {
    const collection = getFirestore().collection("invites");
    let query = (status ? collection.where("status", "==", status) : collection)
      .orderBy("requestedAt", "desc")
      .limit(INVITE_PAGE_SIZE + 1);
    if (cursor) {
      const after = await collection.doc(cursor).get();
      if (!after.exists) {
        response.status(400).json({ error: "invalid cursor" });
        return;
      }
      query = query.startAfter(after);
    }
    const docs = (await query.get()).docs;
    const page = docs.slice(0, INVITE_PAGE_SIZE);
    response.set("Cache-Control", "no-store").status(200).json({
      invites: page.map((doc) => toInvite(doc.id, doc.data())),
      nextCursor: docs.length > INVITE_PAGE_SIZE ? page[page.length - 1].id : null,
    });
  } catch (error) {
    logger.error("Failed to list invites", { status, error });
    response.status(500).json({ error: "Failed to list invites" });
  }
});

/** POST /reviewInvite { email, decision: "approve" | "reject" } */
const handleReviewInvite = requireAdmin(async (request, response, adminId) => {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }
  const review = parseReviewRequest(request.body);
  if (!review) {
    response.status(400).json({ error: "email and a decision of approve or reject are required" });
    return;
  }
  const ref = getFirestore().collection("invites").doc(review.email);
  try {
    // A transaction, so two admins acting at once cannot both approve and send twice.
    const outcome = await getFirestore().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) return { code: 404 as const };
      const current = snapshot.get("status");
      const next = nextInviteStatus(current, review.decision);
      if (!next) return { code: 409 as const, current };
      tx.update(ref, {
        status: next,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: adminId,
        ...(next === "approved" ? { approvedBy: adminId, approvedAt: FieldValue.serverTimestamp() } : {}),
      });
      return { code: 200 as const, next };
    });
    if (outcome.code === 404) {
      response.status(404).json({ error: "invite not found" });
      return;
    }
    if (outcome.code === 409) {
      response.status(409).json({ error: `an invite that is ${outcome.current} cannot be ${review.decision}d` });
      return;
    }
    logger.info("Invite reviewed", { adminId, email: review.email, status: outcome.next });
    response.status(200).json(toInvite(review.email, (await ref.get()).data() ?? {}));
  } catch (error) {
    logger.error("Failed to review invite", { email: review.email, error });
    response.status(500).json({ error: "Failed to review invite" });
  }
});

export const listInvites = onRequest(corsOptions, handleListInvites);
export const reviewInvite = onRequest(corsOptions, handleReviewInvite);
