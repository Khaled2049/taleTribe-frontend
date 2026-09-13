import type { ChatModelAdapter } from "@assistant-ui/react";
import {
  applyEvent,
  AssistantStreamError,
  emptyRunState,
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

type ActiveRequestRef = { current: AbortController | null };

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
}: {
  storyId: string;
  activeRequest: ActiveRequestRef;
  transport: AssistantTransportDependencies;
}): ChatModelAdapter {
  return {
    async *run({ abortSignal, messages }) {
      const controller = new AbortController();
      activeRequest.current = controller;
      const signal = AbortSignal.any([abortSignal, controller.signal]);
      let state = emptyRunState();

      try {
        const prompt = latestUserText(messages);
        for await (const event of streamAssistantRun(
          storyId,
          prompt,
          signal,
          transport,
        )) {
          state = applyEvent(state, event);
          yield toAssistantRunResult(state);

          // Phase 4 is read-only. An unexpected approval request is never
          // turned into a browser control or client-side tool execution.
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
