/**
 * Which of the newest members are worth showing a given viewer.
 *
 * Dependency-free so it can be unit tested directly; the component around it
 * only renders the result.
 */
import type { PublicProfile } from "@novelsync/story-data-client";

/**
 * Newest-first members the viewer is not already connected to.
 *
 * Anyone they already follow is dropped — the card exists to surface people
 * they have not met, and a "Follow" button that already reads "Following" is
 * wasted space. The viewer is dropped for the same reason FollowButton renders
 * nothing for yourself. Order is left as the API returned it (newest first).
 *
 * `viewerId` may be null for a signed-out reader, in which case nothing is
 * excluded and the card is simply a list of recent arrivals.
 */
export const toNewMembers = (
  profiles: PublicProfile[],
  viewerId: string | null,
  following: readonly string[],
  max: number,
): PublicProfile[] => {
  const exclude = new Set<string>(following);
  if (viewerId) exclude.add(viewerId);
  return profiles.filter((p) => p.uid && !exclude.has(p.uid)).slice(0, max);
};
