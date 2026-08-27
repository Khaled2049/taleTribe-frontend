/**
 * Who else has signed a guestbook, derived from entries the page has already
 * loaded.
 *
 * Dependency-free so it can be unit tested directly, matching the other
 * modules here — the component around it only renders the result.
 */
import type { IGuestbookEntry } from "@novelsync/story-data-client";

export interface Signer {
  id: string;
  username: string;
  posts: number;
  latest: IGuestbookEntry["createdAt"];
}

/**
 * Distinct authors, most recent first. Entries arrive newest-first, so the
 * first sighting of an author is also their latest post, and insertion order
 * preserves that — the list is deliberately not re-sorted by post count.
 */
export const toSigners = (
  entries: IGuestbookEntry[],
  exclude: ReadonlySet<string>,
): Signer[] => {
  const seen = new Map<string, Signer>();
  for (const entry of entries) {
    if (!entry.authorId || exclude.has(entry.authorId)) continue;
    const existing = seen.get(entry.authorId);
    if (existing) {
      existing.posts += 1;
      continue;
    }
    seen.set(entry.authorId, {
      id: entry.authorId,
      username: entry.authorUsername,
      posts: 1,
      latest: entry.createdAt,
    });
  }
  return [...seen.values()];
};
