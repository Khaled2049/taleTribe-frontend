import type { PlotEventStatus, PlotLine } from "@/types/IPlot";
import type { PlannedEvent } from "../chapterPlan";
import type { ChapterOption } from "../plotChapters";

export type OutlineSection =
  | {
      key: string;
      kind: "chapter";
      chapter: ChapterOption;
      items: PlannedEvent[];
    }
  | { key: "unassigned"; kind: "unassigned"; items: PlannedEvent[] }
  | { key: string; kind: "line"; line: PlotLine; items: PlannedEvent[] };

const byPlace = (a: PlannedEvent, b: PlannedEvent) =>
  a.event.orderIndex - b.event.orderIndex;

/**
 * One section per chapter in reading order, empty chapters included so they
 * can take a drop, then Unassigned when it has events. An event whose chapter
 * isn't in `chapters` (deleted while this page was open) counts as unassigned.
 */
export function groupByChapter(
  lines: PlotLine[],
  chapters: ChapterOption[],
): OutlineSection[] {
  const known = new Set(chapters.map((c) => c.id));
  const all = lines.flatMap((line) =>
    [...line.events]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((event) => ({ line, event })),
  );
  const sections: OutlineSection[] = chapters.map((chapter) => ({
    key: chapter.id,
    kind: "chapter",
    chapter,
    items: all
      .filter(({ event }) => event.chapterId === chapter.id)
      .sort(
        (a, b) =>
          (a.event.chapterPosition ?? Infinity) -
            (b.event.chapterPosition ?? Infinity) || byPlace(a, b),
      ),
  }));
  const unassigned = all.filter(
    ({ event }) => !event.chapterId || !known.has(event.chapterId),
  );
  if (unassigned.length > 0) {
    sections.push({ key: "unassigned", kind: "unassigned", items: unassigned });
  }
  return sections;
}

/** One section per plot line, in the order lines are listed, events by place in the line. */
export function groupByPlotLine(lines: PlotLine[]): OutlineSection[] {
  return lines.map((line) => ({
    key: line.id,
    kind: "line",
    line,
    items: [...line.events]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((event) => ({ line, event })),
  }));
}

export interface PlotFilter {
  lineId?: string;
  characterId?: string;
  locationId?: string;
  status?: PlotEventStatus;
}

export const isFiltering = (filter: PlotFilter) =>
  Boolean(
    filter.lineId || filter.characterId || filter.locationId || filter.status,
  );

/** Lines with only the events matching every set criterion; lines are kept even when emptied. */
export function filterLines(lines: PlotLine[], filter: PlotFilter): PlotLine[] {
  if (!isFiltering(filter)) return lines;
  return lines
    .filter((line) => !filter.lineId || line.id === filter.lineId)
    .map((line) => ({
      ...line,
      events: line.events.filter(
        (event) =>
          (!filter.characterId ||
            event.characterIds.includes(filter.characterId)) &&
          (!filter.locationId || event.locationId === filter.locationId) &&
          (!filter.status || event.status === filter.status),
      ),
    }));
}

export const countEvents = (lines: PlotLine[]) =>
  lines.reduce((n, line) => n + line.events.length, 0);
