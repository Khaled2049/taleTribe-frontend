import { describe, expect, it } from "vitest";
import {
  chapterPlan,
  planSummary,
  plotEventPath,
} from "@/components/plot/chapterPlan";
import {
  DEFAULT_PLOT_EVENT_VALUES,
  type PlotEvent,
  type PlotEventStatus,
  type PlotLine,
} from "@/types/IPlot";

const ev = (
  id: string,
  chapterId: string | null,
  orderIndex: number,
  status: PlotEventStatus = "planned",
): PlotEvent => ({
  ...DEFAULT_PLOT_EVENT_VALUES,
  id,
  name: id,
  content: "",
  chapterId,
  orderIndex,
  status,
});
const line = (id: string, events: PlotEvent[]): PlotLine => ({
  id,
  name: id,
  description: "",
  events,
});

const lines = [
  line("main", [ev("m2", "c1", 2), ev("m0", "c1", 0), ev("m1", "c2", 1)]),
  line("sub", [ev("s0", "c1", 0, "written"), ev("s1", null, 1)]),
];

describe("chapterPlan", () => {
  it("lists the chapter's events by plot line, then by place in the line", () => {
    expect(chapterPlan(lines, "c1").map(({ event }) => event.id)).toEqual([
      "m0",
      "m2",
      "s0",
    ]);
  });

  it("carries each event's plot line", () => {
    expect(chapterPlan(lines, "c1").map(({ line }) => line.id)).toEqual([
      "main",
      "main",
      "sub",
    ]);
  });

  it("is empty for a chapter with no events, or none open", () => {
    expect(chapterPlan(lines, "c9")).toEqual([]);
    expect(chapterPlan(lines, "")).toEqual([]);
  });
});

describe("planSummary", () => {
  it("counts events and the written ones", () => {
    expect(planSummary(chapterPlan(lines, "c1"))).toBe("3 events · 1 written");
    expect(planSummary(chapterPlan(lines, "c2"))).toBe("1 event");
    expect(planSummary([])).toBe("0 events");
  });
});

describe("plotEventPath", () => {
  it("links to the Plot page, optionally at one event", () => {
    expect(plotEventPath("s1")).toBe("/create/s1/plot");
    expect(plotEventPath("s1", "l1", "e1")).toBe(
      "/create/s1/plot?line=l1&event=e1",
    );
  });
});
