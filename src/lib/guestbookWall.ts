import type { GuestbookDate } from "@novelsync/story-data-client";

/**
 * The Wall feed mixes rows from three sources (your own wall, your own
 * authorship elsewhere, people you follow) so "who posted this" alone
 * doesn't say why it's here. Derived purely from ids already on the entry —
 * no server-side "kind" field exists yet (only "note" posts ship this pass).
 */
export function postContextLine({
  viewerId,
  ownerId,
  authorId,
  ownerUsername,
}: {
  viewerId: string;
  ownerId: string;
  authorId: string;
  ownerUsername?: string;
}): string {
  const isSelfAuthor = authorId === viewerId;
  const isOwnWall = ownerId === viewerId;

  if (isSelfAuthor && isOwnWall) return "you posted this";
  if (isSelfAuthor) return "you left a note on their page";
  if (isOwnWall) return "left a note on your page";
  if (ownerId === authorId) return "posted on their wall";
  return `left a note on @${ownerUsername || "unknown"}'s page`;
}

const toDate = (value: GuestbookDate): Date | null =>
  value instanceof Date ? value : null;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "Today" / "Yesterday" / an absolute date, for the feed's day dividers. */
export function dayLabel(value: GuestbookDate): string {
  const date = toDate(value);
  if (!date) return "";

  const now = new Date();
  if (isSameDay(date, now)) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

/** Groups already-sorted (created_at DESC) entries into day-divider rows. */
export function groupByDay<T extends { createdAt: GuestbookDate }>(
  entries: T[],
): Array<{ isDivider: true; label: string } | { isDivider: false; entry: T }> {
  const rows: Array<
    { isDivider: true; label: string } | { isDivider: false; entry: T }
  > = [];
  let lastLabel: string | null = null;
  for (const entry of entries) {
    const label = dayLabel(entry.createdAt);
    if (label !== lastLabel) {
      rows.push({ isDivider: true, label });
      lastLabel = label;
    }
    rows.push({ isDivider: false, entry });
  }
  return rows;
}
