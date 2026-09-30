import type { Chapter, ChapterSummary } from "@novelsync/story-data-client";

export function toChapterSummary(
  chapter: Chapter | ChapterSummary,
): ChapterSummary {
  if (!("content" in chapter)) return chapter;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { content, ...summary } = chapter;
  return summary;
}

/** The chapters either side of `chapterId`, the likeliest next selections. */
export function neighbourChapterIds(
  chapters: readonly ChapterSummary[],
  chapterId: string,
): string[] {
  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  if (index === -1) return [];
  return [chapters[index - 1], chapters[index + 1]]
    .filter((chapter): chapter is ChapterSummary => chapter !== undefined)
    .map((chapter) => chapter.id);
}
