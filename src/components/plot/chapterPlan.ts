import type { PlotEvent, PlotLine } from "@/types/IPlot";

export interface PlannedEvent {
  line: PlotLine;
  event: PlotEvent;
}

/**
 * A chapter's planned events, by plot line (in the order lines are listed)
 * then by each event's place in its line. There is no order within a chapter
 * yet, so this is the stable order until one exists.
 */
export function chapterPlan(
  lines: PlotLine[],
  chapterId: string | null | undefined,
): PlannedEvent[] {
  if (!chapterId) return [];
  return lines.flatMap((line) =>
    [...line.events]
      .filter((event) => event.chapterId === chapterId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((event) => ({ line, event })),
  );
}

/** "4 events · 1 written", for the panel header. */
export function planSummary(plan: PlannedEvent[]): string {
  const n = plan.length;
  const written = plan.filter(({ event }) => event.status === "written").length;
  const events = n === 1 ? "1 event" : `${n} events`;
  return written > 0 ? `${events} · ${written} written` : events;
}

/** The Plot page, optionally opened on one plot line and event. */
export function plotEventPath(
  storyId: string,
  lineId?: string,
  eventId?: string,
): string {
  const params = new URLSearchParams();
  if (lineId) params.set("line", lineId);
  if (eventId) params.set("event", eventId);
  const query = params.toString();
  return `/create/${storyId}/plot${query ? `?${query}` : ""}`;
}
