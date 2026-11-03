import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeferredDeletes } from "@/components/plot/deferredDeletes";
import { eventsInChapter } from "@/components/plot/plotChapters";
import {
  chapterDeleteText,
  plotLineDeleteLabel,
  plotLineDeleteText,
} from "@/components/plot/plotDeleteCopy";
import { visiblePlotLines } from "@/components/plot/usePlotLines";
import {
  DEFAULT_PLOT_EVENT_VALUES,
  type PlotEvent,
  type PlotLine,
} from "@/types/IPlot";

const ev = (id: string, chapterId: string | null = null): PlotEvent => ({
  ...DEFAULT_PLOT_EVENT_VALUES,
  id,
  name: id,
  content: "",
  chapterId,
  revision: 1,
});
const line = (id: string, events: PlotEvent[]): PlotLine => ({
  id,
  name: id,
  description: "",
  events,
});

describe("DeferredDeletes", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs the delete only when the undo window closes", async () => {
    const deletes = new DeferredDeletes();
    const run = vi.fn();
    deletes.schedule("e1", run, 6000);
    expect(deletes.getSnapshot().has("e1")).toBe(true);
    await vi.advanceTimersByTimeAsync(5999);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledOnce();
  });

  it("undo calls the delete off and shows the event again", async () => {
    const deletes = new DeferredDeletes();
    const run = vi.fn();
    deletes.schedule("e1", run, 6000);
    expect(deletes.undo("e1")).toBe(true);
    expect(deletes.getSnapshot().has("e1")).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).not.toHaveBeenCalled();
  });

  it("keeps the event hidden while the request runs, then forgets it", async () => {
    const deletes = new DeferredDeletes();
    let finish!: () => void;
    deletes.schedule(
      "e1",
      () => new Promise<void>((resolve) => (finish = resolve)),
      6000,
    );
    await vi.advanceTimersByTimeAsync(6000);
    expect(deletes.getSnapshot().has("e1")).toBe(true);
    expect(deletes.undo("e1")).toBe(false); // too late once sent
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(deletes.getSnapshot().has("e1")).toBe(false);
  });

  it("forgets a delete whose request fails, so the caller can restore it", async () => {
    const deletes = new DeferredDeletes();
    deletes.schedule("e1", () => Promise.reject(new Error("409")), 10);
    await vi.advanceTimersByTimeAsync(10);
    expect(deletes.getSnapshot().has("e1")).toBe(false);
  });
});

describe("visiblePlotLines", () => {
  const lines = [line("l1", [ev("a"), ev("b")]), line("l2", [ev("c")])];

  it("hides events waiting to be deleted, leaving other lines untouched", () => {
    const out = visiblePlotLines(lines, () => null, new Set(["b"]));
    expect(out[0].events.map((e) => e.id)).toEqual(["a"]);
    expect(out[1]).toBe(lines[1]);
  });

  it("applies unsaved local edits", () => {
    const out = visiblePlotLines(
      lines,
      (id) => (id === "a" ? { ...ev("a"), name: "edited" } : null),
      new Set(),
    );
    expect(out[0].events[0].name).toBe("edited");
  });
});

describe("delete copy", () => {
  it("states what deleting a plot line takes with it", () => {
    expect(plotLineDeleteText(5)).toBe(
      "This also deletes its 5 events. This can't be undone.",
    );
    expect(plotLineDeleteLabel(1)).toBe("Delete plot line and 1 event");
    expect(plotLineDeleteLabel(0)).toBe("Delete plot line");
  });

  it("warns when a chapter has planned events", () => {
    expect(chapterDeleteText(0)).not.toContain("Unassigned");
    expect(chapterDeleteText(3)).toContain(
      "Its 3 planned events will move to Unassigned.",
    );
  });

  it("counts a chapter's events across plot lines", () => {
    const planned = [
      line("l1", [ev("a", "c1"), ev("b", "c2")]),
      line("l2", [ev("c", "c1")]),
    ];
    expect(eventsInChapter(planned, "c1").map((e) => e.id)).toEqual(["a", "c"]);
    expect(eventsInChapter(planned, null)).toEqual([]);
  });
});
