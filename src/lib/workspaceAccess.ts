export type OwnershipOutcome = "owner" | "denied" | "error";

export interface OwnershipCheck {
  key: string;
  outcome: OwnershipOutcome;
}

export type WorkspaceAccess = "checking" | OwnershipOutcome;

export const ownershipKey = (uid: string, storyId: string) =>
  `${uid}:${storyId}`;

/**
 * A 200 from `GetStory` is not proof of ownership: story-data serves any
 * published story to any caller, so the owner id must match the uid.
 */
export function ownershipOutcome(
  story: { userId: string } | null,
  uid: string,
): OwnershipOutcome {
  return story !== null && story.userId === uid ? "owner" : "denied";
}

/**
 * A check only counts for the uid and story it was made for, so a slow
 * response for a previous story or account can never open this one.
 */
export function workspaceAccess(
  identity: { loading: boolean; uid: string | null },
  storyId: string | undefined,
  check: OwnershipCheck | null,
): WorkspaceAccess {
  if (identity.loading) return "checking";
  if (!identity.uid || !storyId) return "denied";
  if (!check || check.key !== ownershipKey(identity.uid, storyId)) {
    return "checking";
  }
  return check.outcome;
}
