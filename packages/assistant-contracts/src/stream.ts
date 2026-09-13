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

type TerminalEvent = Extract<
  AssistantEvent,
  { type: "run.completed" | "run.failed" | "run.cancelled" }
>;
type UsageEvent = Extract<AssistantEvent, { type: "usage" }>;

export type ProjectedToolCall = {
  toolCallId: string;
  name: string;
  argsText: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status: "running" | "completed" | "failed";
  error?: {
    code: Extract<AssistantEvent, { type: "tool.failed" }>["code"];
    message: string;
  };
};

export type ProjectedApproval = {
  approvalId: string;
  toolCallId: string;
  summary: string;
  approved?: boolean;
};

export type RunUsage = {
  promptTokens: number;
  completionTokens: number;
  credits: number;
  modelCalls: number;
  provider: string | null;
  model: string | null;
  billing: UsageEvent["billing"] | null;
  providers: string[];
  models: string[];
  billingModes: UsageEvent["billing"][];
};

/**
 * Framework-independent projection of a complete multi-step assistant run.
 *
 * A `text.done` frame settles only the current model-call segment. Earlier
 * settled segments survive later tool rounds, while an unfinished delta remains
 * visible as streaming text. Tool argument fragments are ordinary incomplete
 * state until they form a JSON object.
 */
export interface RunState {
  runId: string | null;
  text: string;
  settledText: string;
  streamingText: string;
  toolOrder: string[];
  tools: Record<string, ProjectedToolCall>;
  approvals: Record<string, ProjectedApproval>;
  approvalByToolCallId: Record<string, string>;
  references: Extract<AssistantEvent, { type: "reference.emitted" }>["part"][];
  usage: RunUsage;
  provider: string | null;
  model: string | null;
  terminal: TerminalEvent | null;
  unsupportedCapability: string | null;
}

export function emptyRunState(): RunState {
  return {
    runId: null,
    text: "",
    settledText: "",
    streamingText: "",
    toolOrder: [],
    tools: {},
    approvals: {},
    approvalByToolCallId: {},
    references: [],
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      credits: 0,
      modelCalls: 0,
      provider: null,
      model: null,
      billing: null,
      providers: [],
      models: [],
      billingModes: [],
    },
    provider: null,
    model: null,
    terminal: null,
    unsupportedCapability: null,
  };
}

function parseArgs(argsText: string): Record<string, unknown> | undefined {
  if (!argsText) return undefined;
  try {
    const value: unknown = JSON.parse(argsText);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // A partial JSON fragment is expected while the stream is in progress.
  }
  return undefined;
}

function addUnique<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values : [...values, value];
}

function upsertTool(
  state: RunState,
  toolCallId: string,
  update: (current: ProjectedToolCall | undefined) => ProjectedToolCall,
): Pick<RunState, "toolOrder" | "tools"> {
  const exists = Boolean(state.tools[toolCallId]);
  return {
    toolOrder: exists ? state.toolOrder : [...state.toolOrder, toolCallId],
    tools: { ...state.tools, [toolCallId]: update(state.tools[toolCallId]) },
  };
}

export function applyEvent(state: RunState, event: AssistantEvent): RunState {
  switch (event.type) {
    case "run.started":
      return {
        ...state,
        runId: event.runId,
        provider: event.provider ?? null,
        model: event.model ?? null,
      };
    case "text.delta": {
      const streamingText = state.streamingText + event.text;
      return {
        ...state,
        streamingText,
        text: state.settledText + streamingText,
      };
    }
    case "text.done": {
      const settledText = state.settledText + event.part.text;
      return { ...state, settledText, streamingText: "", text: settledText };
    }
    case "tool.started": {
      const tool = upsertTool(state, event.toolCallId, () => ({
        toolCallId: event.toolCallId,
        name: event.name,
        argsText: "",
        status: "running",
      }));
      return { ...state, ...tool };
    }
    case "tool.args.delta": {
      const tool = upsertTool(state, event.toolCallId, (current) => {
        const argsText = (current?.argsText ?? "") + event.delta;
        return {
          toolCallId: event.toolCallId,
          name: current?.name ?? "unknown_tool",
          ...current,
          argsText,
          args: parseArgs(argsText),
          status: current?.status ?? "running",
        };
      });
      return { ...state, ...tool };
    }
    case "tool.completed": {
      const tool = upsertTool(state, event.part.toolCallId, (current) => ({
        toolCallId: event.part.toolCallId,
        name: event.part.name,
        argsText:
          current?.argsText || JSON.stringify(event.part.arguments ?? {}),
        args: event.part.arguments ?? {},
        result: event.part.result,
        status: "completed",
      }));
      return { ...state, ...tool };
    }
    case "tool.failed": {
      const tool = upsertTool(state, event.toolCallId, (current) => ({
        toolCallId: event.toolCallId,
        name: current?.name ?? "unknown_tool",
        argsText: current?.argsText ?? "",
        args: current?.args,
        status: "failed",
        error: { code: event.code, message: event.message },
      }));
      return { ...state, ...tool };
    }
    case "reference.emitted":
      return { ...state, references: [...state.references, event.part] };
    case "usage":
      return {
        ...state,
        usage: {
          promptTokens: state.usage.promptTokens + event.promptTokens,
          completionTokens:
            state.usage.completionTokens + event.completionTokens,
          credits: state.usage.credits + event.credits,
          modelCalls: state.usage.modelCalls + 1,
          provider: event.provider,
          model: event.model,
          billing: event.billing,
          providers: addUnique(state.usage.providers, event.provider),
          models: addUnique(state.usage.models, event.model),
          billingModes: addUnique(state.usage.billingModes, event.billing),
        },
      };
    case "approval.requested":
      if (!state.tools[event.toolCallId]) {
        return {
          ...state,
          unsupportedCapability:
            "The assistant requested approval for an unknown action. Nothing was changed.",
        };
      }
      return {
        ...state,
        approvals: {
          ...state.approvals,
          [event.approvalId]: {
            approvalId: event.approvalId,
            toolCallId: event.toolCallId,
            summary: event.summary,
          },
        },
        approvalByToolCallId: {
          ...state.approvalByToolCallId,
          [event.toolCallId]: event.approvalId,
        },
      };
    case "approval.resolved": {
      const approval = state.approvals[event.approvalId];
      if (!approval) return state;
      return {
        ...state,
        approvals: {
          ...state.approvals,
          [event.approvalId]: { ...approval, approved: event.approved },
        },
      };
    }
    case "run.completed":
    case "run.failed":
    case "run.cancelled":
      return { ...state, terminal: event };
    default:
      return state;
  }
}
