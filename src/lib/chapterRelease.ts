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
  if (!released) return "Draft — only you can read it";
  return storyPublished
    ? "Released — readers can read it"
    : "Released — goes live when you publish";
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
  const opening = `"${title}" will become visible to readers`;
  const closing = "You can unpublish it again at any time.";
  if (!chapters) {
    return `${opening}. They will see the chapters you have released, or every chapter with text if you have not released any. ${closing}`;
  }
  const released = chapters.filter(isReleased).length;
  if (released > 0) {
    const drafts = chapters.length - released;
    const rest =
      drafts > 0 ? ` Your ${count(drafts)} in draft stay private.` : "";
    return `${opening} with the ${count(released)} you have released.${rest} ${closing}`;
  }
  const written = chapters.filter((chapter) => chapter.wordCount > 0).length;
  if (written === 0) {
    return `${opening}, but with nothing to read: no chapter has any text yet. ${closing}`;
  }
  const empty = chapters.length - written;
  const rest = empty > 0 ? " Empty chapters stay as drafts." : "";
  return `${opening}, and the ${count(written)} you have written will be released.${rest} ${closing}`;
}
