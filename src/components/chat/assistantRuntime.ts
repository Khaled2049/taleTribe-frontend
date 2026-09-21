import type { ChatModelAdapter, ThreadMessage } from "@assistant-ui/react";
import {
  applyEvent,
  AssistantStreamError,
  editorContinuationSchema,
  emptyRunState,
  proposeEditorEditSchema,
  type EditorContinuation,
} from "@novelsync/assistant-contracts";
import {
  AssistantRequestError,
  latestUserText,
  streamAssistantRun,
  type AssistantTransportDependencies,
} from "./assistantTransport";
import {
  toAssistantRunResult,
  type AssistantFailure,
} from "./assistantRunModel";
import { buildHelpRunResult } from "./localHelpResult";
import { parseSlashCommand } from "./slashCommands";
import type { EditorActionLedger } from "./editorActionLedger";

type ActiveRequestRef = { current: AbortController | null };

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function editorContinuationForMessage(
  message: ThreadMessage,
  ledger: EditorActionLedger,
): EditorContinuation | undefined {
  if (message.role !== "assistant") return undefined;
  const applyPart = [...message.content]
    .reverse()
    .find(
      (part) =>
        part.type === "tool-call" &&
        part.toolName === "apply_editor_edit" &&
        part.approval?.approved !== undefined,
    );
  if (applyPart?.type !== "tool-call" || !applyPart.approval) return undefined;

  const action = ledger.get(applyPart.approval.id);
  if (action.status !== "resolved") {
    throw new AssistantRequestError({
      code: "unsupported_capability",
      message: "The editor decision could not be resumed safely. Please retry.",
    });
  }
  const applyArgs = objectValue(applyPart.args);
  const proposalId = applyArgs?.proposalId;
  if (typeof proposalId !== "string") {
    throw new AssistantRequestError({
      code: "unsupported_capability",
      message: "The editor proposal is missing its secure linkage.",
    });
  }
  const proposalPart = [...message.content].reverse().find((part) => {
    if (part.type !== "tool-call" || part.toolName !== "propose_editor_edit") {
      return false;
    }
    return objectValue(part.result)?.proposalId === proposalId;
  });
  if (proposalPart?.type !== "tool-call") {
    throw new AssistantRequestError({
      code: "unsupported_capability",
      message: "The linked editor proposal is no longer available.",
    });
  }
  const proposal = proposeEditorEditSchema.safeParse(proposalPart.args);
  const metadata = objectValue(message.metadata.custom?.novelsync);
  const previousRunId = metadata?.runId;
  if (!proposal.success || typeof previousRunId !== "string") {
    throw new AssistantRequestError({
      code: "unsupported_capability",
      message: "The editor proposal could not be validated locally.",
    });
  }

  return editorContinuationSchema.parse({
    kind: "editor_approval",
    previousRunId,
    approvalId: applyPart.approval.id,
    toolCallId: applyPart.toolCallId,
    proposalId,
    decision: action.decision,
    proposal: proposal.data,
    result: action.result,
    feedback: action.feedback,
  }) as EditorContinuation;
}

function safeRuntimeFailure(error: unknown): AssistantFailure {
  if (error instanceof AssistantRequestError) return error.failure;
  if (error instanceof AssistantStreamError) {
    return {
      code: "malformed_stream",
      message: "The assistant response could not be read safely. Please retry.",
    };
  }
  return {
    code: "network_error",
    message: "The assistant connection was interrupted. Please retry.",
  };
}

export function createAssistantAdapter({
  storyId,
  activeRequest,
  transport,
  actionLedger,
  editsEnabled,
}: {
  storyId: string;
  activeRequest: ActiveRequestRef;
  transport: AssistantTransportDependencies;
  actionLedger: EditorActionLedger;
  /** Mirrors the server flag, so `/help` never lists a tool a run won't offer. */
  editsEnabled: boolean;
}): ChatModelAdapter {
  return {
    async *run({ abortSignal, messages, unstable_getMessage }) {
      const controller = new AbortController();
      activeRequest.current = controller;
      const signal = AbortSignal.any([abortSignal, controller.signal]);
      let state = emptyRunState();

      try {
        const currentMessage = unstable_getMessage();
        const continuation = editorContinuationForMessage(
          currentMessage,
          actionLedger,
        );
        const prompt = latestUserText(messages);

        // `/help` is answered here and goes no further: no request, no token,
        // no credits, and no chance of the model describing a tool it does not
        // have. Checked after the continuation, because an approval resume is
        // not a fresh prompt however its text happens to read.
        if (!continuation && parseSlashCommand(prompt) === "help") {
          yield buildHelpRunResult({ editsEnabled });
          return;
        }

        for await (const event of streamAssistantRun(
          storyId,
          prompt,
          signal,
          transport,
          { continuation },
        )) {
          state = applyEvent(state, event);
          // LocalRuntime already prepends the message's pre-run content to
          // every result it receives, so a resumed run must yield only its own
          // parts. Re-adding them here duplicates each paused toolCallId and
          // useResources throws on the collision.
          yield toAssistantRunResult(state);

          // Approval events that do not reference a known started tool remain
          // unsupported and stop before any browser-side action can occur.
          if (state.unsupportedCapability) {
            controller.abort();
            return;
          }
        }
      } catch (error) {
        if (
          signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          yield toAssistantRunResult(state, { cancelled: true });
          return;
        }
        yield toAssistantRunResult(state, {
          failure: safeRuntimeFailure(error),
        });
      } finally {
        controller.abort();
        if (activeRequest.current === controller) activeRequest.current = null;
      }
    },
  };
}
