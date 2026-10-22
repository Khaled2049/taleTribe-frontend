export const MAX_ROLE_LOOKUP = 50;

// Firebase uids are at most 128 characters.
const isUid = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 128;

export function parseRoleLookup(body: unknown): string[] | null {
  const uids = (body as { uids?: unknown } | null)?.uids;
  if (!Array.isArray(uids) || uids.length > MAX_ROLE_LOOKUP || !uids.every(isUid)) return null;
  return [...new Set(uids)];
}

export function parseRoleChange(body: unknown): { uid: string; admin: boolean } | null {
  const { uid, admin } = (body ?? {}) as Record<string, unknown>;
  if (!isUid(uid) || typeof admin !== "boolean") return null;
  return { uid, admin };
}

/** Keeps every other claim; only `admin` is added or removed. */
export function withAdminClaim(claims: Record<string, unknown> | undefined, admin: boolean) {
  const next = { ...(claims ?? {}) };
  if (admin) next.admin = true;
  else delete next.admin;
  return next;
}
