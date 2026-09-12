/**
 * Reads an SSE body as validated v1 assistant events.
 *
 * Replaces the Phase 0 `readSpikeStream`, which hand-parsed an ad-hoc frame
 * format and enforced a 16 KB cap with a counter. Both jobs move here: framing
 * is still by blank line, but every frame is validated against the schema, and
 * the byte cap is a stated bound on the transport rather than a magic number
 * inside a component.
 *
 * Two run-level invariants are enforced as the stream is consumed, matching
 * `validate_event_sequence` on the Python side: `seq` is dense from 0, and
 * exactly one terminal event arrives, last. A stream that ends without one is
 * an error — that is the case Phase 0 could not distinguish from a mid-run
 * failure, and it is why `run.failed` exists.
 */
import {
  assistantEventSchema,
  isTerminal,
  type AssistantEvent,
} from "./events";

/** Generous for a text run, far below anything that could exhaust memory. */
export const DEFAULT_MAX_STREAM_BYTES = 1_048_576;

export class AssistantStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssistantStreamError";
  }
}

export async function* readAssistantStream(
  body: ReadableStream<Uint8Array>,
  options: { maxBytes?: number } = {},
): AsyncGenerator<AssistantEvent> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_STREAM_BYTES;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bytes = 0;
  let expectedSeq = 0;
  let terminated = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        throw new AssistantStreamError("Assistant stream exceeded its limit");
      }
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (!frame) continue;
        if (!frame.startsWith("data: ")) {
          throw new AssistantStreamError("Malformed assistant stream frame");
        }
        if (terminated) {
          throw new AssistantStreamError("Event after the terminal event");
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(frame.slice(6));
        } catch {
          throw new AssistantStreamError("Assistant stream frame is not JSON");
        }

        const result = assistantEventSchema.safeParse(parsed);
        if (!result.success) {
          throw new AssistantStreamError("Unrecognized assistant event");
        }
        const event = result.data;
        if (event.seq !== expectedSeq) {
          throw new AssistantStreamError(
            `Assistant stream is out of order at ${event.seq}`,
          );
        }
        expectedSeq += 1;
        terminated = isTerminal(event);
        yield event;
      }
    }

    if (!terminated) {
      throw new AssistantStreamError(
        "Assistant stream ended without a terminal event",
      );
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/**
 * Accumulated view of a run, for a UI that renders text as it arrives.
 *
 * `text.delta` is incremental, so the caller accumulates; `text.done` replaces
 * the accumulation with the settled part, which is what a reload would show.
 * Keeping that rule here rather than in a component means every consumer agrees
 * on what the displayed text is.
 */
export interface RunState {
  text: string;
  references: Extract<AssistantEvent, { type: "reference.emitted" }>["part"][];
  usage: Extract<AssistantEvent, { type: "usage" }> | null;
  terminal: AssistantEvent | null;
}

export function emptyRunState(): RunState {
  return { text: "", references: [], usage: null, terminal: null };
}

export function applyEvent(state: RunState, event: AssistantEvent): RunState {
  switch (event.type) {
    case "text.delta":
      return { ...state, text: state.text + event.text };
    case "text.done":
      return { ...state, text: event.part.text };
    case "reference.emitted":
      return { ...state, references: [...state.references, event.part] };
    case "usage":
      return { ...state, usage: event };
    case "run.completed":
    case "run.failed":
    case "run.cancelled":
      return { ...state, terminal: event };
    default:
      return state;
  }
}
