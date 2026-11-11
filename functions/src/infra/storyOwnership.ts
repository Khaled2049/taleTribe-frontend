/** story-data answers 200 for a published story to any caller, so a successful
 * read proves the story exists, not that the caller owns it. */
export function isStoryOwner(story: unknown, userId: string): boolean {
  if (!userId || typeof story !== "object" || story === null) return false;
  return (story as { ownerId?: unknown }).ownerId === userId;
}
