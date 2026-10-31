import { describe, expect, it } from "vitest";
import { buildShape, SERIES_SLOTS } from "@/components/plot/shape/shapeData";
import { chapterOptions } from "@/components/plot/plotChapters";
import { resolvePlotView } from "@/components/plot/plotView";
import {
  DEFAULT_PLOT_EVENT_VALUES,
  type PlotEvent,
  type PlotLine,
} from "@/types/IPlot";

const ev = (
  id: string,
  chapterId: string | null,
  chapterPosition: number | null,
  tensionLevel = 5,
): PlotEvent => ({
  ...DEFAULT_PLOT_EVENT_VALUES,
  id,
  name: id,
  content: "",
  chapterId,
  chapterPosition,
  tensionLevel,
});
const line = (id: string, events: PlotEvent[]): PlotLine => ({
  id,
  name: id,
  description: "",
  events,
});

const chapters = chapterOptions([
  { id: "c1", title: "One", order: 1 },
  { id: "c2", title: "Two", order: 2 },
  { id: "c3", title: "Empty", order: 3 },
]);
const lines = [
  line("main", [
    ev("m-late", "c2", 0, 8),
    ev("m-early", "c1", 1, 3),
    ev("m-loose", null, null),
  ]),
  line("sub", [ev("s-first", "c1", 0, 2)]),
];

describe("buildShape", () => {
  const shape = buildShape(lines, chapters);

  it("puts planned events in reading order: chapter, then place in it", () => {
    expect(shape.points.map((p) => [p.x, p.event.id])).toEqual([
      [0, "s-first"],
      [1, "m-early"],
      [2, "m-late"],
    ]);
  });

  it("leaves unassigned events out and counts them", () => {
    expect(shape.unassigned).toBe(1);
  });

  it("marks a band per chapter that has events", () => {
    expect(shape.bands.map((b) => [b.chapter.id, b.from, b.to])).toEqual([
      ["c1", 0, 1],
      ["c2", 2, 2],
    ]);
  });

  it("gives each series its points in reading order", () => {
    expect(
      shape.series.map((s) => [s.line.id, s.points.map((p) => p.event.id)]),
    ).toEqual([
      ["main", ["m-early", "m-late"]],
      ["sub", ["s-first"]],
    ]);
  });

  it("keeps a line's colour slot from its place in the full list", () => {
    // `empty` has no planned events, so no series, but still holds slot 1.
    const withEmpty = buildShape([line("empty", []), ...lines], chapters);
    expect(withEmpty.series.map((s) => [s.line.id, s.slot])).toEqual([
      ["main", 2],
      ["sub", 3],
    ]);
  });

  it("folds lines past the palette into one shared 'other' colour", () => {
    const many = Array.from({ length: SERIES_SLOTS + 1 }, (_, i) =>
      line(`l${i}`, [ev(`e${i}`, "c1", i)]),
    );
    const slots = buildShape(many, chapters).series.map((s) => s.slot);
    expect(slots.slice(0, SERIES_SLOTS)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(slots[SERIES_SLOTS]).toBeNull();
  });
});

describe("plot view", () => {
  it("accepts the shape view from the URL", () => {
    expect(resolvePlotView(new URLSearchParams("view=shape"), null).view).toBe(
      "shape",
    );
  });
});
