import type { PlotEvent, PlotLine } from "@/types/IPlot";
import type { ChapterOption } from "../plotChapters";

/** Categorical slots in the validated palette; lines past this share "other". */
export const SERIES_SLOTS = 8;

export interface ShapePoint {
  /** Position in reading order, 0-based. */
  x: number;
  event: PlotEvent;
  line: PlotLine;
  chapter: ChapterOption;
  /** 1-based slot into the palette, or null for "other". */
  slot: number | null;
}

export interface ShapeSeries {
  line: PlotLine;
  slot: number | null;
  points: ShapePoint[];
}

export interface ChapterBand {
  chapter: ChapterOption;
  /** First and last x in this chapter. */
  from: number;
  to: number;
}

export interface ShapeData {
  points: ShapePoint[];
  series: ShapeSeries[];
  bands: ChapterBand[];
  unassigned: number;
}

/**
 * Planned events in reading order (chapter order, then place in the chapter),
 * one series per plot line. A line's colour slot comes from its place in the
 * full list, so filtering never repaints the others.
 */
export function buildShape(
  lines: PlotLine[],
  chapters: ChapterOption[],
): ShapeData {
  const chapterAt = new Map(chapters.map((c, i) => [c.id, i]));
  const slotOf = new Map(
    lines.map((line, i) => [line.id, i < SERIES_SLOTS ? i + 1 : null]),
  );
  let unassigned = 0;
  const placed: Omit<ShapePoint, "x">[] = [];
  for (const line of lines) {
    for (const event of line.events) {
      const at = event.chapterId ? chapterAt.get(event.chapterId) : undefined;
      if (at === undefined) {
        unassigned += 1;
        continue;
      }
      placed.push({
        event,
        line,
        chapter: chapters[at],
        slot: slotOf.get(line.id) ?? null,
      });
    }
  }
  placed.sort(
    (a, b) =>
      chapterAt.get(a.chapter.id)! - chapterAt.get(b.chapter.id)! ||
      (a.event.chapterPosition ?? Infinity) -
        (b.event.chapterPosition ?? Infinity) ||
      a.event.orderIndex - b.event.orderIndex,
  );
  const points = placed.map((p, x) => ({ ...p, x }));

  const bands: ChapterBand[] = [];
  for (const point of points) {
    const last = bands[bands.length - 1];
    if (last && last.chapter.id === point.chapter.id) last.to = point.x;
    else bands.push({ chapter: point.chapter, from: point.x, to: point.x });
  }

  const series = lines
    .map((line) => ({
      line,
      slot: slotOf.get(line.id) ?? null,
      points: points.filter((p) => p.line.id === line.id),
    }))
    .filter((s) => s.points.length > 0);

  return { points, series, bands, unassigned };
}

/** y-axis ticks for tension, which runs 1 to 10. */
export const TENSION_TICKS = [0, 2, 4, 6, 8, 10];
