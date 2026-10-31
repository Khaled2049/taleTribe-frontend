import type { ChapterSummary } from "@novelsync/story-data-client";
import type { PlotLine } from "@/types/IPlot";

export interface ChapterOption {
  id: string;
  number: number;
  title: string;
  label: string;
}

/** Chapters in reading order. The number is derived from that order, never stored. */
export function chapterOptions(
  chapters: Pick<ChapterSummary, "id" | "title" | "order">[] | undefined,
): ChapterOption[] {
  return [...(chapters ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((chapter, index) => {
      const title = chapter.title.trim() || "Untitled";
      return {
        id: chapter.id,
        number: index + 1,
        title,
        label: `${index + 1} · ${title}`,
      };
    });
}

/** An event's chapter, or null when it is unassigned or points at a chapter that's gone. */
export function chapterFor(
  options: ChapterOption[],
  chapterId: string | null | undefined,
): ChapterOption | null {
  if (!chapterId) return null;
  return options.find((option) => option.id === chapterId) ?? null;
}

export const UNASSIGNED = "";

/** The select's value for an event, and the chapterId a selected value stands for. */
export const chapterSelectValue = (
  options: ChapterOption[],
  chapterId: string | null | undefined,
) => chapterFor(options, chapterId)?.id ?? UNASSIGNED;

export const chapterIdFromSelect = (value: string): string | null =>
  value === UNASSIGNED ? null : value;

/** Events planned for a chapter, across every plot line. */
export const eventsInChapter = (
  lines: PlotLine[] | undefined,
  chapterId: string | null | undefined,
) =>
  chapterId
    ? (lines ?? []).flatMap((line) =>
        line.events.filter((event) => event.chapterId === chapterId),
      )
    : [];
