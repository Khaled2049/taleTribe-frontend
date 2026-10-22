// The states the agents service and the grant/revoke scripts already use.
// Only "granted" lets a user connect; "revoked" reads as absent, and the
// Firestore rules let the user ask again from it.
export const MCP_STATUSES = ["requested", "granted", "revoked"] as const;
export type McpStatus = (typeof MCP_STATUSES)[number];
export type McpDecision = "grant" | "reject" | "revoke";

export const MCP_PAGE_SIZE = 25;

export function isMcpStatus(value: unknown): value is McpStatus {
  return typeof value === "string" && (MCP_STATUSES as readonly string[]).includes(value);
}

/** The status an admin decision moves a record to, or null when it does not apply. */
export function nextMcpStatus(current: unknown, decision: McpDecision): McpStatus | null {
  switch (decision) {
  case "grant":
    return current === "requested" || current === "revoked" ? "granted" : null;
  case "reject":
    return current === "requested" ? "revoked" : null;
  case "revoke":
    return current === "granted" ? "revoked" : null;
  }
}

export function parseMcpReview(body: unknown): { uid: string; decision: McpDecision } | null {
  if (!body || typeof body !== "object") return null;
  const { uid, decision } = body as Record<string, unknown>;
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return null;
  if (decision !== "grant" && decision !== "reject" && decision !== "revoke") return null;
  return { uid, decision };
}

/** The requester's own note, made safe to show: no control characters, bounded. */
export function displayNote(value: unknown): string {
  if (typeof value !== "string") return "";
  const visible = [...value].map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c));
  return visible.join("").slice(0, 500);
}
