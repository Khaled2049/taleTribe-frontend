import type { EventDependency, PlotEvent, PlotLine } from "@/types/IPlot";
import type { ChapterOption } from "./plotChapters";

export interface EventRef {
  line: PlotLine;
  event: PlotEvent;
}

const allEvents = (lines: PlotLine[]): EventRef[] =>
  lines.flatMap((line) => line.events.map((event) => ({ line, event })));

/** Would making `eventId` require `candidateId` close a loop? */
export function wouldLoop(
  lines: PlotLine[],
  eventId: string,
  candidateId: string,
): boolean {
  if (eventId === candidateId) return true;
  const requires = new Map(
    allEvents(lines).map(({ event }) => [
      event.id,
      event.dependencies.map((d) => d.eventId),
    ]),
  );
  const seen = new Set<string>();
  const stack = [candidateId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === eventId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(requires.get(id) ?? []));
  }
  return false;
}

/** Events that require `eventId`, worked out from every event's requirements. */
export const enabledBy = (lines: PlotLine[], eventId: string): EventRef[] =>
  allEvents(lines).filter(({ event }) =>
    event.dependencies.some((d) => d.eventId === eventId),
  );

export const findEvent = (lines: PlotLine[], eventId: string) =>
  allEvents(lines).find(({ event }) => event.id === eventId);

/**
 * Reading order of planned events: chapter order, then place in the chapter.
 * Unassigned events have no place, so they're never flagged.
 */
export function manuscriptOrder(
  lines: PlotLine[],
  chapters: ChapterOption[],
): Map<string, number> {
  const chapterAt = new Map(chapters.map((c, i) => [c.id, i]));
  const order = new Map<string, number>();
  for (const { event } of allEvents(lines)) {
    const chapter = event.chapterId
      ? chapterAt.get(event.chapterId)
      : undefined;
    if (chapter === undefined) continue;
    order.set(event.id, chapter * 1e6 + (event.chapterPosition ?? 1e5));
  }
  return order;
}

/** A prerequisite placed after the event that needs it. */
export const comesLater = (
  order: Map<string, number>,
  prerequisiteId: string,
  eventId: string,
) => {
  const before = order.get(prerequisiteId);
  const after = order.get(eventId);
  return before !== undefined && after !== undefined && before > after;
};

/** Requirements of `event` that come later and haven't been marked intentional. */
export const lateRequirements = (
  event: PlotEvent,
  order: Map<string, number>,
): EventDependency[] =>
  event.dependencies.filter(
    (d) => !d.outOfOrderOk && comesLater(order, d.eventId, event.id),
  );

export const requirement = (
  target: EventRef,
  outOfOrderOk = false,
): EventDependency => ({
  eventId: target.event.id,
  plotLineId: target.line.id,
  relationshipType: "requires",
  outOfOrderOk,
});
