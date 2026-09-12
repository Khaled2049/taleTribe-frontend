/**
 * The TypeScript half of the three-language contract check.
 *
 * These are the same bytes the Python suite reads (vendored from
 * taleTribe-agents/assistant/fixtures and pinned by a SHA-256 manifest), so a
 * change to the protocol that this client cannot parse fails here rather than
 * at runtime in a browser.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSISTANT_PROTOCOL_VERSION,
  applyEvent,
  assistantEventSchema,
  emptyRunState,
  errorCodeSchema,
  isTerminal,
  readAssistantStream,
  runRequestSchema,
  buildRunRequest,
  AssistantStreamError,
  TERMINAL_EVENT_TYPES,
  LIMITS,
} from "@novelsync/assistant-contracts";

const FIXTURE_DIR = path.resolve(
  __dirname,
  "../packages/assistant-contracts/fixtures",
);

interface Fixture {
  name: string;
  description: string;
  protocolVersion: number;
  events: unknown[];
  sse: string;
}

const fixtures: Fixture[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json") && f !== "MANIFEST.json")
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(FIXTURE_DIR, f), "utf8")));

function streamOf(sse: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(sse);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Split into many small chunks so frame reassembly is actually exercised. */
function chunkedStream(sse: string, size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(sse);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const events = [];
  for await (const event of readAssistantStream(stream)) events.push(event);
  return events;
}

describe("assistant protocol fixtures", () => {
  it("has the agreed fixture set", () => {
    expect(fixtures.map((f) => f.name).sort()).toEqual([
      "approval-pause-resume",
      "cancellation",
      "multi-tool",
      "provider-error",
      "research-citations",
      "single-tool-round",
      "stale-edit",
      "text-only",
    ]);
  });

  it.each(fixtures.map((f) => [f.name, f] as const))(
    "%s parses every event",
    (_name, fixture) => {
      expect(fixture.protocolVersion).toBe(ASSISTANT_PROTOCOL_VERSION);
      for (const raw of fixture.events) {
        expect(assistantEventSchema.safeParse(raw).success).toBe(true);
      }
    },
  );

  it.each(fixtures.map((f) => [f.name, f] as const))(
    "%s round-trips its SSE bytes into the same events",
    async (_name, fixture) => {
      const parsed = await collect(streamOf(fixture.sse));
      expect(parsed).toEqual(
        fixture.events.map((e) => assistantEventSchema.parse(e)),
      );
    },
  );

  it.each(fixtures.map((f) => [f.name, f] as const))(
    "%s survives being split across arbitrary chunk boundaries",
    async (_name, fixture) => {
      // A frame boundary landing mid-multibyte-character is the classic way a
      // hand-rolled SSE reader breaks; TextDecoder streaming mode covers it.
      const parsed = await collect(chunkedStream(fixture.sse, 7));
      expect(parsed.length).toBe(fixture.events.length);
    },
  );

  it.each(fixtures.map((f) => [f.name, f] as const))(
    "%s ends with exactly one terminal event",
    (_name, fixture) => {
      const events = fixture.events.map((e) => assistantEventSchema.parse(e));
      expect(events.filter(isTerminal)).toHaveLength(1);
      expect(isTerminal(events[events.length - 1])).toBe(true);
    },
  );

  it("covers every declared event type across the set", () => {
    const covered = new Set(
      fixtures.flatMap((f) =>
        f.events.map((e) => (e as { type: string }).type),
      ),
    );
    const declared = assistantEventSchema.options.map(
      (option) => option.shape.type.value as string,
    );
    expect(declared.filter((t) => !covered.has(t))).toEqual([]);
  });
});

describe("compatibility policy", () => {
  const base = { v: 1, runId: "r", seq: 0 };

  it("ignores unknown fields on a known event", () => {
    const parsed = assistantEventSchema.parse({
      ...base,
      type: "run.cancelled",
      addedLater: 7,
    });
    expect(parsed).not.toHaveProperty("addedLater");
  });

  it("rejects an unknown event type", () => {
    expect(
      assistantEventSchema.safeParse({ ...base, type: "text.bogus" }).success,
    ).toBe(false);
  });

  it("rejects a foreign protocol version", () => {
    expect(
      assistantEventSchema.safeParse({ ...base, v: 2, type: "run.cancelled" })
        .success,
    ).toBe(false);
  });

  it("enforces generated string bounds", () => {
    expect(
      assistantEventSchema.safeParse({
        ...base,
        type: "text.delta",
        text: "x".repeat(LIMITS.contentChars + 1),
      }).success,
    ).toBe(false);
    expect(
      assistantEventSchema.safeParse({
        ...base,
        runId: "x".repeat(LIMITS.idChars + 1),
        type: "run.cancelled",
      }).success,
    ).toBe(false);
  });

  it("agrees with Python on the terminal set and error codes", () => {
    expect([...TERMINAL_EVENT_TYPES].sort()).toEqual([
      "run.cancelled",
      "run.completed",
      "run.failed",
    ]);
    expect(errorCodeSchema.options).toContain("stale_proposal");
    expect(errorCodeSchema.options).toContain("unsupported_protocol_version");
  });
});

describe("stream errors", () => {
  const terminated =
    'data: {"v":1,"runId":"r","seq":0,"type":"run.cancelled"}\n\n';

  it("rejects a stream that ends without a terminal event", async () => {
    const sse =
      'data: {"v":1,"runId":"r","seq":0,"type":"text.delta","text":"x"}\n\n';
    await expect(collect(streamOf(sse))).rejects.toThrow(AssistantStreamError);
  });

  it("rejects an out-of-order sequence", async () => {
    const sse =
      'data: {"v":1,"runId":"r","seq":0,"type":"text.delta","text":"x"}\n\n' +
      'data: {"v":1,"runId":"r","seq":5,"type":"run.completed","finishReason":"stop"}\n\n';
    await expect(collect(streamOf(sse))).rejects.toThrow(/out of order/);
  });

  it("rejects an event after the terminal event", async () => {
    const sse =
      terminated +
      'data: {"v":1,"runId":"r","seq":1,"type":"text.delta","text":"x"}\n\n';
    await expect(collect(streamOf(sse))).rejects.toThrow(/after the terminal/);
  });

  it("rejects a non-SSE frame", async () => {
    await expect(collect(streamOf('{"not":"sse"}\n\n'))).rejects.toThrow(
      /Malformed/,
    );
  });

  it("rejects a frame that is not JSON", async () => {
    await expect(collect(streamOf("data: not-json\n\n"))).rejects.toThrow(
      /not JSON/,
    );
  });

  it("enforces the byte ceiling", async () => {
    const big = "x".repeat(200);
    const sse = `data: {"v":1,"runId":"r","seq":0,"type":"text.delta","text":"${big}"}\n\n`;
    const iterator = readAssistantStream(streamOf(sse), { maxBytes: 50 });
    await expect(iterator.next()).rejects.toThrow(/exceeded its limit/);
  });
});

describe("run state accumulation", () => {
  it("accumulates deltas and lets text.done settle the result", async () => {
    const fixture = fixtures.find((f) => f.name === "text-only")!;
    let state = emptyRunState();
    for await (const event of readAssistantStream(streamOf(fixture.sse))) {
      state = applyEvent(state, event);
    }
    expect(state.text).toBe("The lighthouse had been dark for a year.");
    expect(state.usage?.billing).toBe("mock");
    expect(state.terminal?.type).toBe("run.completed");
  });

  it("collects references in order", async () => {
    const fixture = fixtures.find((f) => f.name === "research-citations")!;
    let state = emptyRunState();
    for await (const event of readAssistantStream(streamOf(fixture.sse))) {
      state = applyEvent(state, event);
    }
    expect(state.references.map((r) => r.kind)).toEqual(["web", "story"]);
  });

  it("surfaces a mid-stream failure as a terminal event, not a dropped socket", async () => {
    const fixture = fixtures.find((f) => f.name === "provider-error")!;
    let state = emptyRunState();
    for await (const event of readAssistantStream(streamOf(fixture.sse))) {
      state = applyEvent(state, event);
    }
    expect(state.terminal).toMatchObject({
      type: "run.failed",
      code: "provider_unavailable",
    });
  });
});

describe("run request", () => {
  it("builds a valid request and refuses an asserted identity", () => {
    const request = buildRunRequest({
      storyId: "story-1",
      text: "Tighten this",
      clientMessageId: "client-1",
    });
    expect(request.v).toBe(ASSISTANT_PROTOCOL_VERSION);
    expect(request).not.toHaveProperty("userId");
    // storyId is top level, which is what requireStoryOwnership reads.
    expect(request.storyId).toBe("story-1");
    expect(
      runRequestSchema.safeParse({ ...request, userId: "someone-else" })
        .success,
    ).toBe(false);
  });

  it("rejects an empty message", () => {
    expect(
      runRequestSchema.safeParse({
        v: 1,
        storyId: "s",
        clientMessageId: "c",
        message: { role: "user", parts: [] },
      }).success,
    ).toBe(false);
  });

  it("enforces the generated request bounds", () => {
    expect(
      runRequestSchema.safeParse({
        v: 1,
        storyId: "s",
        clientMessageId: "c",
        message: {
          role: "user",
          parts: [{ type: "text", text: "x".repeat(LIMITS.messageChars + 1) }],
        },
      }).success,
    ).toBe(false);
  });
});
