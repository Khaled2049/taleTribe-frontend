import type { PlotLine } from "@/types/IPlot";
import type { OutlineSection } from "./outlineGroups";

/** What a drop or a menu move asks the server to do. */
export type MoveAction =
  | { kind: "none" }
  | {
      kind: "chapterOrder";
      chapterId: string;
      orderedIds: string[];
      /** Listed events arriving from another chapter or Unassigned. */
      movedIn: { id: string; revision?: number }[];
      eventId: string;
    }
  | { kind: "unassign"; lineId: string; eventId: string }
  | { kind: "lineOrder"; lineId: string; orderedIds: string[] }
  | {
      kind: "moveLine";
      fromLineId: string;
      toLineId: string;
      eventId: string;
      toIndex: number;
    };

export interface Spot {
  key: string;
  index: number;
}

const insertAt = <T>(list: T[], index: number, value: T) => {
  const next = [...list];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, value);
  return next;
};

/**
 * Turns "this card, from here to there" into a server call. `sections` is
 * what's on screen; `rawLines` is the cache, which still holds events hidden
 * by a pending delete. The chapter-order endpoint needs every event already
 * in the chapter, hidden ones included, or it refuses the list as stale.
 */
export function planMove(
  sections: OutlineSection[],
  from: Spot,
  to: Spot,
  rawLines: PlotLine[],
): MoveAction {
  const source = sections.find((s) => s.key === from.key);
  const target = sections.find((s) => s.key === to.key);
  const item = source?.items[from.index];
  if (!source || !target || !item) return { kind: "none" };
  if (source.key === target.key && from.index === to.index) {
    return { kind: "none" };
  }
  const { event, line } = item;
  const others = target.items
    .map((i) => i.event.id)
    .filter((id) => id !== event.id);

  switch (target.kind) {
    case "unassigned":
      // Unassigned has no order of its own to change.
      return source.kind === "unassigned"
        ? { kind: "none" }
        : { kind: "unassign", lineId: line.id, eventId: event.id };

    case "chapter": {
      const shown = insertAt(others, to.index, event.id);
      const hidden = rawLines
        .flatMap((l) => l.events)
        .filter(
          (e) => e.chapterId === target.chapter.id && !shown.includes(e.id),
        )
        .map((e) => e.id);
      return {
        kind: "chapterOrder",
        chapterId: target.chapter.id,
        orderedIds: [...shown, ...hidden],
        movedIn:
          source.key === target.key
            ? []
            : [{ id: event.id, revision: event.revision }],
        eventId: event.id,
      };
    }

    case "line":
      return source.key === target.key
        ? {
            kind: "lineOrder",
            lineId: line.id,
            orderedIds: insertAt(others, to.index, event.id),
          }
        : {
            kind: "moveLine",
            fromLineId: line.id,
            toLineId: target.line.id,
            eventId: event.id,
            toIndex: Math.min(to.index, others.length),
          };
  }
}

/** The cache as it will look once a chapter reorder or a line move lands. */
export function applyMove(lines: PlotLine[], action: MoveAction): PlotLine[] {
  if (action.kind === "chapterOrder") {
    const place = new Map(action.orderedIds.map((id, i) => [id, i]));
    return lines.map((line) => ({
      ...line,
      events: line.events.map((event) =>
        place.has(event.id)
          ? {
              ...event,
              chapterId: action.chapterId,
              chapterPosition: place.get(event.id),
            }
          : event,
      ),
    }));
  }
  if (action.kind === "moveLine") {
    const moving = lines
      .find((l) => l.id === action.fromLineId)
      ?.events.find((e) => e.id === action.eventId);
    if (!moving) return lines;
    return lines.map((line) => {
      if (line.id !== action.fromLineId && line.id !== action.toLineId) {
        return line;
      }
      let events = line.events.filter((e) => e.id !== action.eventId);
      if (line.id === action.toLineId) {
        events = insertAt(events, action.toIndex, moving);
      }
      return {
        ...line,
        events: events.map((e, orderIndex) => ({ ...e, orderIndex })),
      };
    });
  }
  return lines;
}

/** The section's name as a screen reader should hear it after a move. */
export function sectionName(section: OutlineSection): string {
  if (section.kind === "chapter") return `Chapter ${section.chapter.label}`;
  if (section.kind === "line") return section.line.name || "Untitled plot line";
  return "Unassigned events";
}

/** "Moved to Chapter 4 · The Storm, position 2 of 5." */
export function describeMove(
  section: OutlineSection,
  index: number,
  sameSection: boolean,
): string {
  const total = section.items.length + (sameSection ? 0 : 1);
  if (section.kind === "unassigned") return "Moved to Unassigned events.";
  return `Moved to ${sectionName(section)}, position ${index + 1} of ${total}.`;
}
