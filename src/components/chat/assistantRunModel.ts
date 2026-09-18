import type {
  ChatModelRunResult,
  MessageStatus,
  ThreadAssistantMessagePart,
  ToolCallMessagePart,
} from "@assistant-ui/react";
import type {
  Capability,
  ErrorCode,
  ProjectedApproval,
  ProjectedToolCall,
  RunState,
  RunUsage,
  SourcePart,
} from "@novelsync/assistant-contracts";

export type AssistantFailureCode =
  | ErrorCode
  | "malformed_stream"
  | "network_error"
  | "unauthenticated"
  | "unsupported_capability";

export type AssistantFailure = {
  code: AssistantFailureCode;
  message: string;
};

/** A locally answered `/help`, carried on metadata so the panel can render it. */
export type AssistantHelp = {
  preamble: string;
  boundaries: readonly string[];
  capabilities: readonly Capability[];
};

export type AssistantMessageMetadata = {
  /**
   * `local_help` is the browser answering itself: no run, no tokens, no
   * credits. It is a metadata discriminator rather than a new content part
   * because parts are the server-owned protocol vocabulary, and a client-only
   * part type would be a word only one side of the wire knows.
   */
  kind: "run" | "local_help";
  help: AssistantHelp | null;
  runId: string | null;
  provider: string | null;
  model: string | null;
  usage: RunUsage;
  finishReason: string | null;
  notice: string | null;
  failure: AssistantFailure | null;
};

export type AssistantRunOverride = {
  failure?: AssistantFailure;
  cancelled?: boolean;
};

function toolPart(
  tool: ProjectedToolCall,
  approval?: ProjectedApproval,
): ThreadAssistantMessagePart {
  const result =
    tool.status === "failed"
      ? {
          code: tool.error?.code ?? "internal_error",
          message: tool.error?.message,
        }
      : tool.status === "completed"
        ? (tool.result ?? null)
        : undefined;

  return {
    type: "tool-call",
    toolCallId: tool.toolCallId,
    toolName: tool.name,
    args: (tool.args ?? {}) as ToolCallMessagePart["args"],
    argsText: tool.argsText,
    result,
    isError: tool.status === "failed",
    approval: approval
      ? {
          id: approval.approvalId,
          prompt: approval.summary,
          display: "decision",
          approved: approval.approved,
        }
      : undefined,
  };
}

function sourcePart(source: SourcePart): ThreadAssistantMessagePart {
  return {
    type: "source",
    sourceType: "document",
    id: source.sourceId,
    title: source.title,
    mediaType: "application/vnd.novelsync.story-reference+json",
    providerMetadata: {
      novelsync: {
        kind: source.kind,
        sourceId: source.sourceId,
        title: source.title,
        snippet: source.snippet ?? null,
        url: source.url ?? null,
      },
    },
  };
}

function terminalFailure(state: RunState): AssistantFailure | null {
  if (state.unsupportedCapability) {
    return {
      code: "unsupported_capability",
      message: state.unsupportedCapability,
    };
  }
  if (state.terminal?.type === "run.failed") {
    return { code: state.terminal.code, message: state.terminal.message };
  }
  return null;
}

function messageStatus(
  state: RunState,
  failure: AssistantFailure | null,
  cancelled: boolean,
): MessageStatus {
  if (cancelled || state.terminal?.type === "run.cancelled") {
    return { type: "incomplete", reason: "cancelled" };
  }
  if (failure) {
    return { type: "incomplete", reason: "error", error: failure };
  }
  const pendingApproval = Object.values(state.approvals).some(
    (approval) => approval.approved === undefined,
  );
  if (
    pendingApproval &&
    state.terminal?.type === "run.completed" &&
    state.terminal.finishReason === "tool_calls"
  ) {
    return { type: "requires-action", reason: "tool-calls" };
  }
  if (state.terminal?.type !== "run.completed") return { type: "running" };

  switch (state.terminal.finishReason) {
    case "stop":
      return { type: "complete", reason: "stop" };
    case "length":
      return { type: "incomplete", reason: "length" };
    case "max_steps":
    case "tool_calls":
      return { type: "incomplete", reason: "other" };
    default:
      return { type: "complete", reason: "unknown" };
  }
}

function textPartStatus(status: MessageStatus) {
  switch (status.type) {
    case "running":
      return { type: "running" as const };
    case "complete":
      return { type: "complete" as const };
    case "incomplete":
      return {
        type: "incomplete" as const,
        reason:
          status.reason === "length"
            ? ("length" as const)
            : status.reason === "cancelled"
              ? ("cancelled" as const)
              : status.reason === "error"
                ? ("error" as const)
                : ("other" as const),
      };
    case "requires-action":
      return { type: "incomplete" as const, reason: "other" as const };
  }
}

function completionNotice(state: RunState, cancelled: boolean): string | null {
  if (cancelled || state.terminal?.type === "run.cancelled") {
    return "Stopped. The partial response above was kept.";
  }
  if (state.terminal?.type !== "run.completed") return null;
  if (state.terminal.finishReason === "max_steps") {
    return "Stopped early after reaching the reading-step limit. The partial result is shown above.";
  }
  if (state.terminal.finishReason === "length") {
    return "The response reached its output limit. The partial result is shown above.";
  }
  if (state.terminal.finishReason === "tool_calls") {
    if (
      Object.values(state.approvals).some(
        (approval) => approval.approved === undefined,
      )
    ) {
      return null;
    }
    return "The response stopped before the requested reading work was finished.";
  }
  return null;
}

/** Convert the protocol projection into cumulative, display-only assistant-ui parts. */
export function toAssistantRunResult(
  state: RunState,
  override: AssistantRunOverride = {},
): ChatModelRunResult {
  const failure = override.failure ?? terminalFailure(state);
  const cancelled = override.cancelled ?? false;
  const status = messageStatus(state, failure, cancelled);
  const content: ThreadAssistantMessagePart[] = state.toolOrder.map((id) => {
    const approvalId = state.approvalByToolCallId[id];
    return toolPart(
      state.tools[id],
      approvalId ? state.approvals[approvalId] : undefined,
    );
  });

  if (state.text) {
    content.push({
      type: "text",
      text: state.text,
      status:
        state.streamingText && !state.terminal
          ? { type: "running" }
          : textPartStatus(status),
    });
  }
  content.push(...state.references.map(sourcePart));

  if (content.length === 0 && status.type !== "running") {
    content.push({
      type: "text",
      text:
        failure?.message ??
        (status.type === "incomplete" && status.reason === "cancelled"
          ? "Stopped before responding."
          : "The assistant finished without a response."),
      status: textPartStatus(status),
    });
  }

  const metadata: AssistantMessageMetadata = {
    kind: "run",
    help: null,
    runId: state.runId,
    provider: state.usage.provider ?? state.provider,
    model: state.usage.model ?? state.model,
    usage: state.usage,
    finishReason: cancelled
      ? "run.cancelled"
      : state.terminal?.type === "run.completed"
        ? (state.terminal.finishReason ?? "stop")
        : (state.terminal?.type ?? null),
    notice: completionNotice(state, cancelled),
    failure,
  };

  return {
    content,
    status,
    metadata: {
      custom: { novelsync: metadata },
      steps:
        state.usage.modelCalls > 0
          ? [
              {
                usage: {
                  inputTokens: state.usage.promptTokens,
                  outputTokens: state.usage.completionTokens,
                },
              },
            ]
          : undefined,
    },
  };
}

export function assistantFailureForStatus(status: number): AssistantFailure {
  switch (status) {
    case 401:
      return {
        code: "unauthenticated",
        message: "Sign in again to use the story assistant.",
      };
    case 402:
      return {
        code: "quota_exceeded",
        message:
          "You have used up your assistant allowance for now. Add your own API key in Settings to keep going.",
      };
    case 403:
      return {
        code: "story_access_denied",
        message: "This story is not available to the assistant.",
      };
    case 409:
      return {
        code: "unsupported_protocol_version",
        message: "The assistant needs an update before it can respond safely.",
      };
    case 429:
      return {
        code: "rate_limited",
        message:
          "The assistant is receiving too many requests. Try again shortly.",
      };
    default:
      return {
        code: "provider_unavailable",
        message: "The assistant is unavailable right now. Try again shortly.",
      };
  }
}
