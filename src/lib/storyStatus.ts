import type { CompletionStatus, Story } from "@novelsync/story-data-client";

export const STATUS_LABELS: Record<CompletionStatus, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
};

/** The discovery filter's `?status=` value; anything unknown means "all". */
export function statusFromParam(value: string | null): CompletionStatus | "" {
  return value === "ongoing" || value === "completed" ? value : "";
}

/**
 * `nextChapterOn` is a calendar date with no timezone, so it is built from its
 * parts: `new Date("2026-10-20")` is UTC midnight and shows as the 19th west
 * of Greenwich.
 */
export function formatNextChapterDate(
  value: string | undefined,
  now = new Date(),
  locale?: string,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

export interface ReaderUpdateView {
  /** Null when the story is completed or the author gave no date. */
  nextChapter: string | null;
  note: string | null;
}

/** What a reader is shown, or null when the author has said nothing. */
export function readerUpdateView(
  story: Pick<Story, "completionStatus" | "nextChapterOn" | "readerNote">,
  now = new Date(),
  locale?: string,
): ReaderUpdateView | null {
  const nextChapter =
    story.completionStatus === "completed"
      ? null
      : formatNextChapterDate(story.nextChapterOn, now, locale);
  const note = story.readerNote?.trim() || null;
  return nextChapter || note ? { nextChapter, note } : null;
}
