import type { Chapter } from "@novelsync/story-data-client";

export function nextChapterPosition(
  chapters: readonly Pick<Chapter, "order">[],
): number {
  return chapters.reduce(
    (next, chapter) => Math.max(next, Math.floor(chapter.order) + 1),
    0,
  );
}
