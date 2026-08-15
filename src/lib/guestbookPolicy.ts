/**
 * Who may sign a user's guestbook.
 *
 * Deliberately import-free so vitest can load it directly, and so the pure gate
 * below can be unit-tested against the same matrix the rules tests assert. The
 * authority is `mayPostOnWall()` in firestore.rules — this module only decides
 * whether to render a compose form. KEEP IN SYNC: a disagreement shows a form
 * whose write is then rejected, or hides one that would have worked.
 */

export type GuestbookPolicy =
  | "nobody"
  | "following"
  | "mutuals"
  | "followers"
  | "everyone";

export const GUESTBOOK_POLICIES: readonly GuestbookPolicy[] = [
  "everyone",
  "followers",
  "mutuals",
  "following",
  "nobody",
] as const;

export const GUESTBOOK_POLICY_LABELS: Record<
  GuestbookPolicy,
  { label: string; description: string }
> = {
  everyone: {
    label: "Everyone",
    description: "Any signed-in member can leave a note.",
  },
  followers: {
    label: "People who follow me",
    description: "Only members who follow you can leave a note.",
  },
  mutuals: {
    label: "Mutual follows",
    description: "Only members you follow who also follow you back.",
  },
  following: {
    label: "People I follow",
    description: "Only members you follow can leave a note.",
  },
  nobody: {
    label: "Nobody",
    description: "Your guestbook is closed. Only you can post on it.",
  },
};

const isPolicy = (value: unknown): value is GuestbookPolicy =>
  typeof value === "string" &&
  (GUESTBOOK_POLICIES as readonly string[]).includes(value);

/**
 * An absent or unrecognised value reads as "everyone" — the setting is additive,
 * so accounts that predate it keep today's open wall rather than silently
 * closing. The rules default the same way.
 */
export const normalizePolicy = (value: unknown): GuestbookPolicy =>
  isPolicy(value) ? value : "everyone";

export interface WallAccess {
  policy: unknown;
  ownerId: string;
  viewerId: string | null;
  /** The viewer's own `following` array. */
  viewerFollowing: readonly string[];
  /** The viewer's own `followers` array. */
  viewerFollowers: readonly string[];
}

/**
 * The follow graph is stored on both sides, so the viewer answers both questions
 * from their own user document — they cannot read the owner's. The equivalences:
 * "the owner follows me" is `ownerId ∈ me.followers`, and "I follow the owner"
 * is `ownerId ∈ me.following`.
 */
export const canPostOnWall = ({
  policy,
  ownerId,
  viewerId,
  viewerFollowing,
  viewerFollowers,
}: WallAccess): boolean => {
  if (!viewerId) return false;
  if (viewerId === ownerId) return true;

  const iFollowOwner = viewerFollowing.includes(ownerId);
  const ownerFollowsMe = viewerFollowers.includes(ownerId);

  switch (normalizePolicy(policy)) {
    case "everyone":
      return true;
    case "followers":
      return iFollowOwner;
    case "following":
      return ownerFollowsMe;
    case "mutuals":
      return iFollowOwner && ownerFollowsMe;
    case "nobody":
      return false;
  }
};

/** Why the compose form is hidden, for the reader of someone else's wall. */
export const wallClosedReason = (
  policy: unknown,
  username: string,
): string => {
  switch (normalizePolicy(policy)) {
    case "followers":
      return `@${username} only accepts notes from people who follow them.`;
    case "following":
      return `@${username} only accepts notes from people they follow.`;
    case "mutuals":
      return `@${username} only accepts notes from mutual follows.`;
    case "nobody":
      return `@${username} has closed their guestbook.`;
    default:
      return `@${username} is not accepting notes right now.`;
  }
};
