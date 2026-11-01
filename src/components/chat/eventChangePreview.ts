import type { StoryChange } from "@novelsync/assistant-contracts";
import type { EventDependency, PlotEvent, PlotLine } from "@/types/IPlot";
import { chapterFor, type ChapterOption } from "@/components/plot/plotChapters";
import {
  comesLater,
  findEvent,
  manuscriptOrder,
  requirement,
} from "@/components/plot/requirements";

export interface ChapterDiff {
  before: string;
  after: string;
}

export interface RequiresDiff {
  added: string[];
  removed: string[];
}

const chapterLabel = (
  chapters: ChapterOption[],
  chapterId: string | null | undefined,
) =>
  chapterId
    ? (chapterFor(chapters, chapterId)?.label ?? "Unknown chapter")
    : "Unassigned";

/** The event an update targets, from the cached plot lines. */
const target = (change: StoryChange, lines: PlotLine[]) =>
  change.operation === "event.update" && change.entityId
    ? findEvent(lines, change.entityId)?.event
    : undefined;

/** `null` when the change leaves the chapter alone or doesn't move it. */
export function chapterDiff(
  change: StoryChange,
  lines: PlotLine[],
  chapters: ChapterOption[],
): ChapterDiff | null {
  if (!change.boundChapter) return null;
  const after = change.boundChapter.label;
  if (change.operation === "event.create") return { before: "", after };
  const current = target(change, lines);
  const before = chapterLabel(chapters, current?.chapterId);
  return (current?.chapterId ?? null) === (change.boundChapter.id ?? null)
    ? null
    : { before, after };
}

/** Prerequisites gained and lost, by name; `null` when nothing changes. */
export function requiresDiff(
  change: StoryChange,
  lines: PlotLine[],
): RequiresDiff | null {
  const bound = change.boundRequires;
  if (!bound) return null;
  const before = target(change, lines)?.dependencies ?? [];
  const next = new Set(bound.map((ref) => ref.id));
  const had = new Set(before.map((d) => d.eventId));
  const added = bound
    .filter((ref) => ref.id && !had.has(ref.id))
    .map((ref) => ref.label);
  const removed = before
    .filter((d) => !next.has(d.eventId))
    .map((d) => findEvent(lines, d.eventId)?.event.name ?? "A deleted event");
  return added.length || removed.length ? { added, removed } : null;
}

/**
 * The event's chapter and requirements after the change, in story-data's
 * shape. Kept requirements keep their note and their "intentional" mark.
 */
export function eventLinks(
  change: StoryChange,
  current: Pick<PlotEvent, "chapterId" | "dependencies"> | undefined,
  lines: PlotLine[],
): Partial<Pick<PlotEvent, "chapterId" | "dependencies">> {
  const links: Partial<Pick<PlotEvent, "chapterId" | "dependencies">> = {};
  if (change.boundChapter) links.chapterId = change.boundChapter.id ?? null;
  if (change.boundRequires) {
    const kept = new Map(
      (current?.dependencies ?? []).map((d) => [d.eventId, d]),
    );
    links.dependencies = change.boundRequires.flatMap(
      (ref): EventDependency[] => {
        if (!ref.id) return [];
        const existing = kept.get(ref.id);
        if (existing) return [existing];
        const found = findEvent(lines, ref.id);
        // Bound by the agent but gone since: saving would be refused anyway.
        return found ? [requirement(found)] : [];
      },
    );
  }
  return links;
}

/**
 * Prerequisites that would come later in the manuscript than the event that
 * needs them, once the change is saved. Moving an event appends it to its new
 * chapter, so it's placed last there.
 */
export function outOfOrderWarnings(
  change: StoryChange,
  lines: PlotLine[],
  chapters: ChapterOption[],
): string[] {
  if (change.operation !== "event.update" || !change.entityId) return [];
  if (!change.boundChapter && !change.boundRequires) return [];
  const current = target(change, lines);
  if (!current) return [];
  const links = eventLinks(change, current, lines);
  const moved =
    links.chapterId !== undefined && links.chapterId !== current.chapterId;
  const updated: PlotEvent = {
    ...current,
    ...links,
    chapterPosition: moved ? null : current.chapterPosition,
  };
  const after = lines.map((line) => ({
    ...line,
    events: line.events.map((event) =>
      event.id === current.id ? updated : event,
    ),
  }));
  const order = manuscriptOrder(after, chapters);
  const name = (id: string) => findEvent(lines, id)?.event.name ?? "an event";
  const warnings = updated.dependencies
    .filter((d) => !d.outOfOrderOk && comesLater(order, d.eventId, current.id))
    .map((d) => `“${name(d.eventId)}” would come after this event.`);
  for (const line of after) {
    for (const event of line.events) {
      const link = event.dependencies.find((d) => d.eventId === current.id);
      if (
        link &&
        !link.outOfOrderOk &&
        comesLater(order, current.id, event.id)
      ) {
        warnings.push(`“${event.name}” would come before this event.`);
      }
    }
  }
  return warnings;
}
