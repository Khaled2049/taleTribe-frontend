import type { StoryChange } from "@novelsync/assistant-contracts";
import type { PlotEvent, PlotLine } from "@/types/IPlot";
import { chapterFor, type ChapterOption } from "@/components/plot/plotChapters";

export interface ChapterDiff {
  before: string;
  after: string;
}

const chapterLabel = (
  chapters: ChapterOption[],
  chapterId: string | null | undefined,
) =>
  chapterId
    ? (chapterFor(chapters, chapterId)?.label ?? "Unknown chapter")
    : "Unassigned";

const findEvent = (lines: PlotLine[], eventId: string) =>
  lines.flatMap((line) => line.events).find((event) => event.id === eventId);

/** `null` when the change leaves the chapter alone or doesn't move it. */
export function chapterDiff(
  change: StoryChange,
  lines: PlotLine[],
  chapters: ChapterOption[],
): ChapterDiff | null {
  if (!change.boundChapter) return null;
  const after = change.boundChapter.label;
  if (change.operation === "event.create") return { before: "", after };
  const current = change.entityId
    ? findEvent(lines, change.entityId)
    : undefined;
  const before = chapterLabel(chapters, current?.chapterId);
  return (current?.chapterId ?? null) === (change.boundChapter.id ?? null)
    ? null
    : { before, after };
}

/** The event's chapter after the change, in story-data's shape. */
export function eventLinks(
  change: StoryChange,
): Partial<Pick<PlotEvent, "chapterId">> {
  return change.boundChapter
    ? { chapterId: change.boundChapter.id ?? null }
    : {};
}
