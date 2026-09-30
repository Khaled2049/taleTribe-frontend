import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveCancelledError, SaveQueue, SaveState } from "@/lib/saveQueue";

interface Deferred {
  content: string;
  resolve: (revision: number) => void;
  reject: (error: unknown) => void;
}

function setup() {
  const calls: Deferred[] = [];
  const states: SaveState[] = [];
  let enabled = true;
  const queue = new SaveQueue({
    getOnSave: () => (content) =>
      new Promise<number | undefined>((resolve, reject) => {
        calls.push({ content, resolve, reject });
      }),
    isEnabled: () => enabled,
    debounceMs: 3000,
    onStateChange: (state) => states.push(state),
    onDirtyChange: () => {},
  });
  return {
    queue,
    calls,
    states,
    disable: () => {
      enabled = false;
    },
  };
}

// Lets awaited onSave promises settle and the save loop advance.
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SaveQueue debounce", () => {
  it("saves the latest content once after the debounce", async () => {
    const { queue, calls } = setup();
    queue.trigger("a");
    queue.trigger("ab");
    await vi.advanceTimersByTimeAsync(2999);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.map((c) => c.content)).toEqual(["ab"]);
  });

  it("does nothing while disabled", async () => {
    const { queue, calls, disable } = setup();
    disable();
    queue.trigger("a");
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(0);
    await expect(queue.flushAndWait()).resolves.toBeUndefined();
  });
});

describe("SaveQueue.flushAndWait", () => {
  it("resolves immediately with the last revision when nothing is pending", async () => {
    const { queue, calls } = setup();
    queue.trigger("a");
    const first = queue.flushAndWait();
    await settle();
    calls[0].resolve(7);
    await expect(first).resolves.toBe(7);

    await expect(queue.flushAndWait()).resolves.toBe(7);
    expect(calls).toHaveLength(1);
  });

  it("saves a debounced edit now and resolves with its revision", async () => {
    const { queue, calls } = setup();
    queue.trigger("a");
    const done = queue.flushAndWait();
    await settle();
    expect(calls.map((c) => c.content)).toEqual(["a"]);
    calls[0].resolve(3);
    await expect(done).resolves.toBe(3);
    expect(queue.isDirty).toBe(false);
  });

  it("rejects when the save fails, leaving the edit dirty", async () => {
    const { queue, calls } = setup();
    queue.trigger("a");
    const done = queue.flushAndWait();
    await settle();
    const error = new Error("503");
    calls[0].reject(error);
    await expect(done).rejects.toBe(error);
    expect(queue.isDirty).toBe(true);
  });

  it("retries a previously failed save", async () => {
    const { queue, calls } = setup();
    queue.trigger("a");
    const failed = queue.flushAndWait();
    await settle();
    calls[0].reject(new Error("503"));
    await expect(failed).rejects.toThrow("503");

    const retried = queue.flushAndWait();
    await settle();
    expect(calls.map((c) => c.content)).toEqual(["a", "a"]);
    calls[1].resolve(4);
    await expect(retried).resolves.toBe(4);
  });

  it("waits for edits queued behind an in-flight save", async () => {
    const { queue, calls } = setup();
    queue.trigger("a");
    await vi.advanceTimersByTimeAsync(3000);
    queue.trigger("ab");

    let settled = false;
    const done = queue.flushAndWait().then((revision) => {
      settled = true;
      return revision;
    });
    calls[0].resolve(1);
    await settle();
    expect(settled).toBe(false);
    expect(calls.map((c) => c.content)).toEqual(["a", "ab"]);

    calls[1].resolve(2);
    await expect(done).resolves.toBe(2);
  });

  it("rejects when a queued follow-up save fails", async () => {
    const { queue, calls } = setup();
    queue.trigger("a");
    await vi.advanceTimersByTimeAsync(3000);
    queue.trigger("ab");
    const done = queue.flushAndWait();
    calls[0].resolve(1);
    await settle();
    calls[1].reject(new Error("409"));
    await expect(done).rejects.toThrow("409");
  });

  it("does not resend content that is already in flight", async () => {
    const { queue, calls } = setup();
    queue.trigger("a");
    await vi.advanceTimersByTimeAsync(3000);
    const done = queue.flushAndWait();
    calls[0].resolve(1);
    await expect(done).resolves.toBe(1);
    expect(calls).toHaveLength(1);
  });
});

describe("SaveQueue.reset", () => {
  it("rejects waiters with SaveCancelledError", async () => {
    const { queue } = setup();
    queue.trigger("a");
    await vi.advanceTimersByTimeAsync(3000);
    const done = queue.flushAndWait();
    queue.reset();
    await expect(done).rejects.toBeInstanceOf(SaveCancelledError);
  });

  it("cancels a pending debounce", async () => {
    const { queue, calls } = setup();
    queue.trigger("a");
    queue.reset();
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(0);
    expect(queue.isDirty).toBe(false);
  });

  it("does not let a superseded save stamp state or block the next chapter", async () => {
    const { queue, calls, states } = setup();
    queue.trigger("old chapter");
    await vi.advanceTimersByTimeAsync(3000);
    queue.reset();

    queue.trigger("new chapter");
    const done = queue.flushAndWait();
    await settle();
    expect(calls.map((c) => c.content)).toEqual(["old chapter", "new chapter"]);

    calls[0].resolve(1);
    await settle();
    expect(states.at(-1)?.status).toBe("saving");

    calls[1].resolve(9);
    await expect(done).resolves.toBe(9);
    expect(states.at(-1)?.status).toBe("saved");
  });
});

describe("SaveQueue.flushPending", () => {
  it("saves a debounced edit immediately", async () => {
    const { queue, calls } = setup();
    queue.trigger("a");
    queue.flushPending();
    await settle();
    expect(calls.map((c) => c.content)).toEqual(["a"]);
  });

  it("is a no-op with nothing pending", async () => {
    const { queue, calls } = setup();
    queue.flushPending();
    await settle();
    expect(calls).toHaveLength(0);
  });
});
