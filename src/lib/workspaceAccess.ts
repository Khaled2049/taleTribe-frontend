export type WorkspaceAccess = "checking" | "owner" | "denied" | "error";

/**
 * A 200 from `GetStory` is not proof of ownership: story-data serves any
 * published story to any caller, so the owner id must match the uid.
 */
export function ownershipOutcome(
  story: { userId: string } | null,
  uid: string,
): "owner" | "denied" {
  return story !== null && story.userId === uid ? "owner" : "denied";
}

/**
 * `story` must come from a query keyed by this uid and story id, so a result
 * for a previous story or account can never open this one.
 */
export function workspaceAccess(
  identity: { loading: boolean; uid: string | null },
  storyId: string | undefined,
  story: {
    status: "pending" | "error" | "success";
    fetchStatus: "fetching" | "paused" | "idle";
    data: { userId: string } | null | undefined;
  },
): WorkspaceAccess {
  if (identity.loading) return "checking";
  if (!identity.uid || !storyId) return "denied";
  if (story.data !== undefined)
    return ownershipOutcome(story.data, identity.uid);
  return story.status === "error" && story.fetchStatus !== "fetching"
    ? "error"
    : "checking";
}
