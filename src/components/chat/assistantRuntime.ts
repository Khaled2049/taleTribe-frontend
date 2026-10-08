import type { ChatModelAdapter, ThreadMessage } from "@assistant-ui/react";
import {
  applyEvent,
  AssistantStreamError,
  editorContinuationSchema,
  emptyRunState,
  entityContinuationSchema,
  proposeEditorEditSchema,
  proposeStoryChangesSchema,
  type AssistantContinuation,
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
import { buildHelpRunResult, buildLocalNotice } from "./localHelpResult";
import { parseRoomCommand, parseSlashCommand } from "./slashCommands";
import type { EditorActionLedger } from "./editorActionLedger";
import { objectValue, proposalArgs } from "./toolParts";

type ActiveRequestRef = { current: AbortController | null };

const APPROVAL_KINDS = {
  apply_editor_edit: {
    kind: "editor_approval",
    proposeTool: "propose_editor_edit",
    proposalSchema: proposeEditorEditSchema,
    continuationSchema: editorContinuationSchema,
    failure: "The editor decision could not be resumed safely. Please retry.",
  },
  apply_story_changes: {
    kind: "entity_approval",
    proposeTool: "propose_story_changes",
    proposalSchema: proposeStoryChangesSchema,
    continuationSchema: entityContinuationSchema,
    failure: "The story change could not be resumed safely. Please retry.",
  },
} as const;

/**
 * The continuation for the approval this message was just resumed from.
 *
 * A resumed run writes into the same message, so one message can hold decided
 * approvals of both kinds. Only the latest one is being resumed; searching per
 * tool would resend an older decision of the other kind.
 */
export function continuationForMessage(
  message: ThreadMessage,
  ledger: EditorActionLedger,
): AssistantContinuation | undefined {
  if (message.role !== "assistant") return undefined;
  const applyPart = [...message.content]
    .reverse()
    .find(
      (part) =>
        part.type === "tool-call" &&
        Object.prototype.hasOwnProperty.call(APPROVAL_KINDS, part.toolName) &&
        part.approval?.approved !== undefined,
    );
  if (applyPart?.type !== "tool-call" || !applyPart.approval) return undefined;
  const spec =
    APPROVAL_KINDS[applyPart.toolName as keyof typeof APPROVAL_KINDS];

  const action = ledger.get(applyPart.approval.id);
  const proposalId = objectValue(applyPart.args)?.proposalId;
  const proposal = spec.proposalSchema.safeParse(
    proposalArgs(message.content, spec.proposeTool, proposalId),
  );
  const previousRunId = objectValue(message.metadata.custom?.novelsync)?.runId;
  if (
    action.status !== "resolved" ||
    typeof proposalId !== "string" ||
    !proposal.success ||
    typeof previousRunId !== "string"
  ) {
    throw new AssistantRequestError({
      code: "unsupported_capability",
      message: spec.failure,
    });
  }

  return spec.continuationSchema.parse({
    kind: spec.kind,
    previousRunId,
    approvalId: applyPart.approval.id,
    toolCallId: applyPart.toolCallId,
    proposalId,
    decision: action.decision,
    proposal: proposal.data,
    // Both schemas are strict, so each gets only its own result field.
    ...(spec.kind === "editor_approval"
      ? { result: action.result }
      : { results: action.results }),
    feedback: action.feedback,
  }) as AssistantContinuation;
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
        const continuation = continuationForMessage(
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

        // `/room <question>` convenes the specialists on purpose. The command
        // is stripped, so the room is briefed with the question itself.
        const roomQuestion = continuation ? null : parseRoomCommand(prompt);
        if (roomQuestion === "") {
          yield buildLocalNotice(
            "Add your question after /room — for example: /room why does my ending feel weak?",
          );
          return;
        }

        for await (const event of streamAssistantRun(
          storyId,
          roomQuestion ?? prompt,
          signal,
          transport,
          { continuation, mode: roomQuestion ? "room" : undefined },
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
