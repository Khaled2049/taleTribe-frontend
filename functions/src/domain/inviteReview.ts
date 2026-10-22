export const INVITE_STATUSES = ["pending", "approved", "sent", "completed", "rejected"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];
export type InviteDecision = "approve" | "reject";

export const INVITE_PAGE_SIZE = 25;

export function isInviteStatus(value: unknown): value is InviteStatus {
  return typeof value === "string" && (INVITE_STATUSES as readonly string[]).includes(value);
}

/**
 * The status an admin decision moves an invite to, or null when it may not.
 * Moving into "approved" is what makes onInviteApproved send the email, so an
 * invite already sent or completed is never approved again from here.
 */
export function nextInviteStatus(current: unknown, decision: InviteDecision): InviteStatus | null {
  if (decision === "approve") return current === "pending" || current === "rejected" ? "approved" : null;
  return current === "pending" ? "rejected" : null;
}

export function parseReviewRequest(body: unknown): { email: string; decision: InviteDecision } | null {
  if (!body || typeof body !== "object") return null;
  const { email, decision } = body as Record<string, unknown>;
  if (typeof email !== "string" || email.length === 0 || email.length > 320 || email.includes("/")) return null;
  if (decision !== "approve" && decision !== "reject") return null;
  return { email, decision };
}
