import { describe, expect, it } from "vitest";
import {
  countEvents,
  filterLines,
  groupByChapter,
  groupByPlotLine,
  isFiltering,
} from "@/components/plot/outline/outlineGroups";
import { chapterOptions } from "@/components/plot/plotChapters";
import { DEFAULT_PLOT_VIEW, resolvePlotView } from "@/components/plot/plotView";
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
  extra: Partial<PlotEvent> = {},
): PlotEvent => ({
  ...DEFAULT_PLOT_EVENT_VALUES,
  id,
  name: id,
  content: "",
  orderIndex,
  chapterId,
  chapterPosition,
  ...extra,
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
  line("main", [ev("m0", 0, "c1", 1), ev("m1", 1, "c2", 0), ev("m2", 2)]),
  line("sub", [ev("s0", 0, "c1", 0), ev("s1", 1, "gone", 0)]),
];
const ids = (items: { event: PlotEvent }[]) =>
  items.map(({ event }) => event.id);

describe("groupByChapter", () => {
  const sections = groupByChapter(lines, chapters);

  it("orders a chapter's events by chapter position, across plot lines", () => {
    expect(sections[0].key).toBe("c1");
    expect(ids(sections[0].items)).toEqual(["s0", "m0"]);
  });

  it("keeps empty chapters so they can take events", () => {
    expect(sections.map((s) => s.key)).toEqual([
      "c1",
      "c2",
      "c3",
      "unassigned",
    ]);
    expect(sections[2].items).toEqual([]);
  });

  it("puts unassigned events, and events of a vanished chapter, last", () => {
    expect(ids(sections[3].items)).toEqual(["m2", "s1"]);
  });

  it("leaves out Unassigned when nothing is unassigned", () => {
    const placed = [line("main", [ev("a", 0, "c1", 0)])];
    expect(groupByChapter(placed, chapters).map((s) => s.key)).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
  });

  it("changes no event's data", () => {
    const before = JSON.stringify(lines);
    groupByChapter(lines, chapters);
    groupByPlotLine(lines);
    expect(JSON.stringify(lines)).toBe(before);
  });
});

describe("groupByPlotLine", () => {
  it("lists each line's events by place in the line, each exactly once", () => {
    const sections = groupByPlotLine([
      line("main", [ev("b", 1), ev("a", 0)]),
      line("sub", []),
    ]);
    expect(sections.map((s) => [s.key, ids(s.items)])).toEqual([
      ["main", ["a", "b"]],
      ["sub", []],
    ]);
  });
});

describe("filterLines", () => {
  const cast = [
    line("main", [
      ev("a", 0, null, null, { characterIds: ["mara"], status: "written" }),
      ev("b", 1, null, null, { characterIds: ["mara"], locationId: "ford" }),
      ev("c", 2, null, null, { locationId: "ford", status: "written" }),
    ]),
    line("sub", [ev("d", 0, null, null, { characterIds: ["mara"] })]),
  ];

  it("returns the same lines when no filter is set", () => {
    expect(isFiltering({})).toBe(false);
    expect(filterLines(cast, {})).toBe(cast);
  });

  it("combines criteria with AND", () => {
    const out = filterLines(cast, { characterId: "mara", locationId: "ford" });
    expect(out.flatMap((l) => l.events.map((e) => e.id))).toEqual(["b"]);
  });

  it("filters by plot line and by status", () => {
    expect(filterLines(cast, { lineId: "sub" }).map((l) => l.id)).toEqual([
      "sub",
    ]);
    expect(countEvents(filterLines(cast, { status: "written" }))).toBe(2);
  });
});

describe("resolvePlotView", () => {
  const params = (q: string) => new URLSearchParams(q);

  it("defaults to the outline grouped by chapter", () => {
    expect(resolvePlotView(params(""), null)).toEqual(DEFAULT_PLOT_VIEW);
    expect(DEFAULT_PLOT_VIEW).toEqual({ view: "outline", group: "chapters" });
  });

  it("prefers the URL, then the remembered choice", () => {
    const remembered = { view: "grid" as const, group: "lines" as const };
    expect(resolvePlotView(params(""), remembered)).toEqual(remembered);
    expect(resolvePlotView(params("view=outline"), remembered)).toEqual({
      view: "outline",
      group: "lines",
    });
  });

  it("ignores values it doesn't know", () => {
    expect(
      resolvePlotView(params("view=kanban&group=mood"), {
        view: "board" as never,
      }),
    ).toEqual(DEFAULT_PLOT_VIEW);
  });
});
