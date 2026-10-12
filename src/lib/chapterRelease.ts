import type { ChapterSummary } from "@novelsync/story-data-client";

type ReleaseInfo = Pick<ChapterSummary, "publishedAt" | "wordCount">;

export const isReleased = (chapter: Pick<ChapterSummary, "publishedAt">) =>
  Boolean(chapter.publishedAt);

/** Drafts are only worth marking once some chapter is, or could be, public. */
export function showsDraftMarks(
  storyPublished: boolean,
  chapters: readonly ReleaseInfo[],
): boolean {
  return storyPublished || chapters.some(isReleased);
}

export function chapterStatusLine(
  released: boolean,
  storyPublished: boolean,
): string {
  if (!released) return "Draft · Private";
  return storyPublished ? "Released · Live" : "Released · Publish to go live";
}

const count = (n: number) => (n === 1 ? "1 chapter" : `${n} chapters`);

/**
 * What publishing will show readers. KEEP IN SYNC with
 * `releaseWrittenChapters` in story-data: a first publish releases every
 * chapter with text, unless the author has already released some.
 *
 * Pass no chapters where they are not loaded, as on the shelf.
 */
export function publishDescription(
  title: string,
  chapters?: readonly ReleaseInfo[],
): string {
  if (!chapters) {
    return `Publish "${title}" with released chapters, or all chapters with text if none are released.`;
  }
  const released = chapters.filter(isReleased).length;
  if (released > 0) {
    const drafts = chapters.length - released;
    const rest = drafts > 0 ? ` ${count(drafts)} stay private.` : "";
    return `Publish "${title}" with ${count(released)}.${rest}`;
  }
  const written = chapters.filter((chapter) => chapter.wordCount > 0).length;
  if (written === 0) {
    return `Publish "${title}" without any chapter text?`;
  }
  const empty = chapters.length - written;
  const rest = empty > 0 ? " Empty chapters stay private." : "";
  return `Publish "${title}" and release ${count(written)}.${rest}`;
}
