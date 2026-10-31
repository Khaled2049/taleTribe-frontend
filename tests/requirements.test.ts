import { describe, expect, it } from "vitest";
import {
  comesLater,
  enabledBy,
  lateRequirements,
  manuscriptOrder,
  requirement,
  wouldLoop,
} from "@/components/plot/requirements";
import { chapterOptions } from "@/components/plot/plotChapters";
import {
  DEFAULT_PLOT_EVENT_VALUES,
  type PlotEvent,
  type PlotLine,
} from "@/types/IPlot";

const ev = (
  id: string,
  requires: string[] = [],
  chapterId: string | null = null,
  chapterPosition: number | null = null,
  outOfOrderOk = false,
): PlotEvent => ({
  ...DEFAULT_PLOT_EVENT_VALUES,
  id,
  name: id,
  content: "",
  chapterId,
  chapterPosition,
  dependencies: requires.map((eventId) => ({
    eventId,
    plotLineId: "?",
    relationshipType: "requires" as const,
    outOfOrderOk,
  })),
});
const line = (id: string, events: PlotEvent[]): PlotLine => ({
  id,
  name: id,
  description: "",
  events,
});

// letter ← confront ← mutiny, and rumour (another line) ← letter.
const lines = [
  line("main", [
    ev("letter"),
    ev("confront", ["letter"]),
    ev("mutiny", ["confront"]),
  ]),
  line("sub", [ev("rumour", ["letter"])]),
];

describe("wouldLoop", () => {
  it("refuses an event requiring itself, directly or through others", () => {
    expect(wouldLoop(lines, "letter", "letter")).toBe(true);
    expect(wouldLoop(lines, "letter", "mutiny")).toBe(true);
    expect(wouldLoop(lines, "letter", "confront")).toBe(true);
  });

  it("allows links that don't come back round, across plot lines", () => {
    expect(wouldLoop(lines, "mutiny", "rumour")).toBe(false);
    expect(wouldLoop(lines, "rumour", "confront")).toBe(false);
  });
});

describe("enabledBy", () => {
  it("derives what an event enables from every event's requirements", () => {
    expect(enabledBy(lines, "letter").map(({ event }) => event.id)).toEqual([
      "confront",
      "rumour",
    ]);
    expect(enabledBy(lines, "mutiny")).toEqual([]);
  });
});

describe("manuscript order", () => {
  const chapters = chapterOptions([
    { id: "c1", title: "One", order: 1 },
    { id: "c2", title: "Two", order: 2 },
  ]);
  const placed = [
    line("main", [
      ev("reveal", [], "c2", 0),
      ev("aftermath", ["reveal"], "c1", 0),
      ev("flashback", ["reveal"], "c1", 1, true),
      ev("loose", ["reveal"]),
    ]),
  ];
  const order = manuscriptOrder(placed, chapters);

  it("flags a prerequisite placed after the event that needs it", () => {
    expect(comesLater(order, "reveal", "aftermath")).toBe(true);
    expect(comesLater(order, "aftermath", "reveal")).toBe(false);
  });

  it("never flags unassigned events", () => {
    expect(comesLater(order, "reveal", "loose")).toBe(false);
  });

  it("leaves out late requirements the writer marked intentional", () => {
    const [, aftermath, flashback] = placed[0].events;
    expect(lateRequirements(aftermath, order)).toHaveLength(1);
    expect(lateRequirements(flashback, order)).toHaveLength(0);
  });
});

describe("requirement", () => {
  it("builds a requires link carrying the target's plot line", () => {
    expect(requirement({ line: lines[1], event: lines[1].events[0] })).toEqual({
      eventId: "rumour",
      plotLineId: "sub",
      relationshipType: "requires",
      outOfOrderOk: false,
    });
  });
});
