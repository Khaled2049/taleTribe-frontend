export type FeedMode = "pages" | "scroll";

export const FEED_MODE_KEY = "tt:feed-mode";
export const PAGER_HINTS_KEY = "tt:feed-pager-hints-dismissed";

/** Pages is the default on purpose: the feed should have a bottom. */
export function parseFeedMode(value: string | null | undefined): FeedMode {
  return value === "scroll" ? "scroll" : "pages";
}

/**
 * The wall is cursor-paged with no total, so the pager can only offer the
 * pages already fetched plus the one the next cursor would load.
 */
export function knownPageCount(loadedPages: number, hasNextPage: boolean) {
  return Math.max(1, loadedPages + (hasNextPage ? 1 : 0));
}

/** One-line commentary under the pager, escalating with depth. 1-based. */
export function pageQuip(page: number, isLastPage: boolean): string {
  if (isLastPage && page > 1) {
    return "That's the end. You have officially finished this part of the internet.";
  }
  if (isLastPage) return "That's everything. Short, sweet, finite.";
  if (page <= 1) return "Ten posts. A healthy, finite number.";
  if (page === 2) return "Page 2. Still a perfectly reasonable person.";
  if (page <= 4) return `Page ${page}. Maybe stretch your neck a little.`;
  if (page <= 7) return `Page ${page}. Have you had any water today?`;
  if (page <= 11)
    return `Page ${page}. Your thumb has filed a formal complaint.`;
  return `Page ${page}. Somewhere, a book you meant to read is gathering dust.`;
}

export const DOOM_CHECKPOINT_EVERY = 30;

/** Shown in doom mode after every DOOM_CHECKPOINT_EVERY posts; null otherwise. */
export function doomCheckpoint(postsSeen: number): string | null {
  if (postsSeen <= 0 || postsSeen % DOOM_CHECKPOINT_EVERY !== 0) return null;
  const lap = postsSeen / DOOM_CHECKPOINT_EVERY;
  const lines = [
    `${postsSeen} posts in. Just checking you still blink.`,
    `${postsSeen} posts. Pagination misses you. It said so.`,
    `${postsSeen} posts. This is the doom part of doom mode.`,
  ];
  return lines[Math.min(lap, lines.length) - 1];
}
