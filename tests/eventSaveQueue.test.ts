import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  StoryDataConflictError,
  StoryDataError,
} from "@novelsync/story-data-client";
import {
  EventSaveQueue,
  eventsInState,
  lineSaveState,
  withLocalEdits,
} from "@/components/plot/eventSaveQueue";
import { DEFAULT_PLOT_EVENT_VALUES, type PlotEvent } from "@/types/IPlot";

const event = (name: string, revision = 1): PlotEvent => ({
  ...DEFAULT_PLOT_EVENT_VALUES,
  id: "e1",
  name,
  content: "",
  revision,
});

/** A send whose responses the test resolves or rejects by hand. */
function harness() {
  const calls: {
    event: PlotEvent;
    resolve: (saved: PlotEvent) => void;
    reject: (error: unknown) => void;
  }[] = [];
  const applied: { saved: PlotEvent; revisionOnly: boolean }[] = [];
  const queue = new EventSaveQueue({
    send: (_line, sent) =>
      new Promise((resolve, reject) =>
        calls.push({ event: sent, resolve, reject }),
      ),
    applySaved: (_line, saved, revisionOnly) =>
      applied.push({ saved, revisionOnly }),
    debounceMs: 600,
    savedMs: 2000,
  });
  const state = () => queue.getSnapshot().get("e1")?.state ?? null;
  return { queue, calls, applied, state };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

describe("EventSaveQueue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("coalesces edits within the debounce into one save of the latest", async () => {
    const { queue, calls, state } = harness();
    queue.schedule("l1", event("a"));
    queue.schedule("l1", event("ab"));
    expect(state()).toBe("pending");
    await vi.advanceTimersByTimeAsync(599);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.map((c) => c.event.name)).toEqual(["ab"]);
    expect(state()).toBe("saving");
  });

  it("holds an edit made during a save, then sends it with the new revision", async () => {
    const { queue, calls, applied } = harness();
    queue.schedule("l1", event("first", 1), { immediate: true });
    queue.schedule("l1", event("second", 1));
    await vi.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(1); // still waiting on the first

    calls[0].resolve(event("first", 2));
    await settle();
    expect(calls).toHaveLength(2);
    expect(calls[1].event).toMatchObject({ name: "second", revision: 2 });
    // The response must not overwrite the newer local edit.
    expect(applied).toEqual([{ saved: event("first", 2), revisionOnly: true }]);
  });

  it("waits out the debounce of an edit that is still settling when the save returns", async () => {
    const { queue, calls } = harness();
    queue.schedule("l1", event("first"), { immediate: true });
    queue.schedule("l1", event("second"));
    calls[0].resolve(event("first", 2));
    await settle();
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(2);
  });

  it("applies the full response when nothing newer is waiting, then settles", async () => {
    const { queue, calls, applied, state } = harness();
    queue.schedule("l1", event("only"), { immediate: true });
    calls[0].resolve(event("only", 2));
    await settle();
    expect(applied).toEqual([{ saved: event("only", 2), revisionOnly: false }]);
    expect(state()).toBe("saved");
    expect(queue.local("e1")).toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    expect(state()).toBeNull();
  });

  it("keeps the local value when a save fails, and Retry resends it", async () => {
    const { queue, calls, state } = harness();
    queue.schedule("l1", event("typed"), { immediate: true });
    calls[0].reject(new StoryDataError(500, "boom"));
    await settle();
    expect(state()).toBe("error");
    expect(queue.local("e1")?.name).toBe("typed");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(1); // no silent retry

    queue.retry(["e1"]);
    expect(calls).toHaveLength(2);
    expect(calls[1].event.name).toBe("typed");
  });

  it("keeps an edit typed during a failing save rather than the failed one", async () => {
    const { queue, calls } = harness();
    queue.schedule("l1", event("old"), { immediate: true });
    queue.schedule("l1", event("newer"));
    calls[0].reject(new StoryDataError(500, "boom"));
    await settle();
    expect(queue.local("e1")?.name).toBe("newer");
  });

  it("a new edit after a failure saves again", async () => {
    const { queue, calls } = harness();
    queue.schedule("l1", event("a"), { immediate: true });
    calls[0].reject(new StoryDataError(500, "boom"));
    await settle();
    queue.schedule("l1", event("ab"));
    await vi.advanceTimersByTimeAsync(600);
    expect(calls.map((c) => c.event.name)).toEqual(["a", "ab"]);
  });

  it("on a 409, holds edits until the writer reloads", async () => {
    const { queue, calls, state } = harness();
    queue.schedule("l1", event("mine"), { immediate: true });
    calls[0].reject(new StoryDataConflictError());
    await settle();
    expect(state()).toBe("conflict");

    queue.schedule("l1", event("mine, more"));
    await vi.advanceTimersByTimeAsync(600);
    queue.retry(["e1"]);
    expect(calls).toHaveLength(1);
    expect(state()).toBe("conflict");

    queue.discard("e1");
    expect(state()).toBeNull();
    expect(queue.local("e1")).toBeNull();
  });

  it("flush sends debounced edits at once", () => {
    const { queue, calls } = harness();
    queue.schedule("l1", event("leaving"));
    queue.flush();
    expect(calls.map((c) => c.event.name)).toEqual(["leaving"]);
  });

  it("ignores the result of a save for an event discarded meanwhile", async () => {
    const { queue, calls, applied, state } = harness();
    queue.schedule("l1", event("doomed"), { immediate: true });
    queue.discard("e1");
    calls[0].resolve(event("doomed", 2));
    await settle();
    expect(applied).toEqual([]);
    expect(state()).toBeNull();
  });

  it("notifies subscribers with a new snapshot", () => {
    const { queue } = harness();
    const listener = vi.fn();
    queue.subscribe(listener);
    const before = queue.getSnapshot();
    queue.schedule("l1", event("a"));
    expect(listener).toHaveBeenCalled();
    expect(queue.getSnapshot()).not.toBe(before);
  });
});

describe("save state helpers", () => {
  const statuses = new Map([
    ["a", { lineId: "l1", state: "saved" as const }],
    ["b", { lineId: "l1", state: "error" as const }],
    ["c", { lineId: "l1", state: "saving" as const }],
    ["d", { lineId: "l2", state: "conflict" as const }],
  ]);

  it("reports the most serious state per line", () => {
    expect(lineSaveState(statuses, "l1")).toBe("error");
    expect(lineSaveState(statuses, "l2")).toBe("conflict");
    expect(lineSaveState(statuses, "l3")).toBeNull();
  });

  it("lists a line's events in one state", () => {
    expect(eventsInState(statuses, "l1", "error")).toEqual(["b"]);
  });

  it("lays local edits over fetched data, keeping the local revision", () => {
    const lines = [
      { id: "l1", name: "L", description: "", events: [event("server", 5)] },
    ];
    // A refetch that carries another writer's revision 5 must not lend it to
    // an edit based on 3, or that edit would overwrite theirs without a 409.
    const out = withLocalEdits(lines, () => event("local", 3));
    expect(out[0].events[0]).toMatchObject({ name: "local", revision: 3 });
    expect(withLocalEdits(lines, () => null)[0]).toBe(lines[0]);
  });
});
