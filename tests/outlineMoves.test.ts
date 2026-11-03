import { describe, expect, it } from "vitest";
import {
  groupByChapter,
  groupByPlotLine,
} from "@/components/plot/outline/outlineGroups";
import {
  applyMove,
  describeMove,
  planMove,
} from "@/components/plot/outline/moves";
import { chapterOptions } from "@/components/plot/plotChapters";
import { EventSaveQueue } from "@/components/plot/eventSaveQueue";
import {
  DEFAULT_PLOT_EVENT_VALUES,
  type PlotEvent,
  type PlotLine,
} from "@/types/IPlot";

const ev = (
  id: string,
  orderIndex: number,
  chapterId: string | null = null,
  chapterPosition: number | null = null,
): PlotEvent => ({
  ...DEFAULT_PLOT_EVENT_VALUES,
  id,
  name: id,
  content: "",
  orderIndex,
  chapterId,
  chapterPosition,
  revision: 3,
});
const line = (id: string, events: PlotEvent[]): PlotLine => ({
  id,
  name: id,
  description: "",
  events,
  revision: 1,
});

const chapters = chapterOptions([
  { id: "c1", title: "One", order: 1 },
  { id: "c2", title: "Two", order: 2 },
]);
const lines = [
  line("main", [ev("a", 0, "c1", 0), ev("b", 1, "c1", 1), ev("u", 2)]),
  line("sub", [ev("x", 0, "c2", 0), ev("y", 1)]),
];
const byChapter = groupByChapter(lines, chapters);
const byLine = groupByPlotLine(lines);

describe("planMove by chapter", () => {
  it("reorders within a chapter without moving anything in", () => {
    expect(
      planMove(
        byChapter,
        { key: "c1", index: 0 },
        { key: "c1", index: 1 },
        lines,
      ),
    ).toEqual({
      kind: "chapterOrder",
      chapterId: "c1",
      orderedIds: ["b", "a"],
      movedIn: [],
      eventId: "a",
    });
  });

  it("pulls an event into another chapter at the drop position", () => {
    const action = planMove(
      byChapter,
      { key: "c1", index: 1 },
      { key: "c2", index: 0 },
      lines,
    );
    expect(action).toEqual({
      kind: "chapterOrder",
      chapterId: "c2",
      orderedIds: ["b", "x"],
      movedIn: [{ id: "b", revision: 3 }],
      eventId: "b",
    });
  });

  it("keeps events hidden by a pending delete in the chapter's list", () => {
    // `h` is in the cache but not on screen.
    const raw = [
      ...lines.slice(0, 1),
      line("sub", [...lines[1].events, ev("h", 2, "c2", 1)]),
    ];
    const action = planMove(
      byChapter,
      { key: "unassigned", index: 0 },
      { key: "c2", index: 1 },
      raw,
    );
    expect(action).toMatchObject({ orderedIds: ["x", "u", "h"] });
  });

  it("unassigns an event dropped on Unassigned, and ignores reordering there", () => {
    expect(
      planMove(
        byChapter,
        { key: "c1", index: 0 },
        { key: "unassigned", index: 0 },
        lines,
      ),
    ).toEqual({ kind: "unassign", lineId: "main", eventId: "a" });
    expect(
      planMove(
        byChapter,
        { key: "unassigned", index: 0 },
        { key: "unassigned", index: 1 },
        lines,
      ),
    ).toEqual({ kind: "none" });
  });

  it("does nothing for a drop where it started", () => {
    expect(
      planMove(
        byChapter,
        { key: "c1", index: 1 },
        { key: "c1", index: 1 },
        lines,
      ),
    ).toEqual({ kind: "none" });
  });
});

describe("planMove by plot line", () => {
  it("reorders within a line", () => {
    expect(
      planMove(
        byLine,
        { key: "main", index: 2 },
        { key: "main", index: 0 },
        lines,
      ),
    ).toEqual({
      kind: "lineOrder",
      lineId: "main",
      orderedIds: ["u", "a", "b"],
    });
  });

  it("moves to another line at the drop position, clamped to its end", () => {
    expect(
      planMove(
        byLine,
        { key: "main", index: 0 },
        { key: "sub", index: 9 },
        lines,
      ),
    ).toEqual({
      kind: "moveLine",
      fromLineId: "main",
      toLineId: "sub",
      eventId: "a",
      toIndex: 2,
    });
  });
});

describe("applyMove", () => {
  it("places events in a chapter in the given order", () => {
    const out = applyMove(lines, {
      kind: "chapterOrder",
      chapterId: "c2",
      orderedIds: ["b", "x"],
      movedIn: [],
      eventId: "b",
    });
    const b = out[0].events.find((e) => e.id === "b")!;
    expect(b).toMatchObject({ chapterId: "c2", chapterPosition: 0 });
  });

  it("moves an event between lines and renumbers both", () => {
    const out = applyMove(lines, {
      kind: "moveLine",
      fromLineId: "main",
      toLineId: "sub",
      eventId: "a",
      toIndex: 1,
    });
    expect(out[0].events.map((e) => [e.id, e.orderIndex])).toEqual([
      ["b", 0],
      ["u", 1],
    ]);
    expect(out[1].events.map((e) => [e.id, e.orderIndex])).toEqual([
      ["x", 0],
      ["a", 1],
      ["y", 2],
    ]);
  });
});

describe("describeMove", () => {
  it("names the place an event landed", () => {
    expect(describeMove(byChapter[1], 0, false)).toBe(
      "Moved to Chapter 2 · Two, position 1 of 2.",
    );
    expect(describeMove(byChapter[2], 0, false)).toBe(
      "Moved to Unassigned events.",
    );
  });
});

describe("EventSaveQueue.relocate", () => {
  it("sends a pending edit to the event's new line with the moved fields", async () => {
    const sent: { line: string; event: PlotEvent }[] = [];
    const queue = new EventSaveQueue({
      send: (lineId, event) => {
        sent.push({ line: lineId, event });
        return Promise.resolve(event);
      },
      applySaved: () => {},
    });
    queue.schedule("main", { ...ev("a", 0, "c1", 0), name: "typed" });
    queue.relocate("a", "sub", { chapterId: "c2" });
    queue.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].line).toBe("sub");
    expect(sent[0].event).toMatchObject({ name: "typed", chapterId: "c2" });
  });
});
