import type { ThreadMessage } from "@assistant-ui/react";
import {
  buildRunRequest,
  readAssistantStream,
  type AssistantEvent,
} from "@novelsync/assistant-contracts";
import {
  assistantFailureForStatus,
  type AssistantFailure,
} from "./assistantRunModel";

export type AssistantTransportDependencies = {
  endpoint: string;
  getIdToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
  createClientMessageId?: () => string;
};

export class AssistantRequestError extends Error {
  constructor(readonly failure: AssistantFailure) {
    super(failure.message);
    this.name = "AssistantRequestError";
  }
}

function abortError(): DOMException {
  return new DOMException("Assistant request cancelled", "AbortError");
}

async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) throw abortError();
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export function latestUserText(messages: readonly ThreadMessage[]): string {
  let userMessage: ThreadMessage | undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      userMessage = messages[index];
      break;
    }
  }
  return (
    userMessage?.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim() ?? ""
  );
}

/**
 * The only browser-to-assistant transport. It sends one v1 user message and
 * deliberately excludes transcript history, asserted identity, and secrets.
 */
export async function* streamAssistantRun(
  storyId: string,
  text: string,
  signal: AbortSignal,
  dependencies: AssistantTransportDependencies,
): AsyncGenerator<AssistantEvent> {
  const token = await abortable(dependencies.getIdToken(), signal);
  if (!token) {
    throw new AssistantRequestError({
      code: "unauthenticated",
      message: "Sign in again to use the story assistant.",
    });
  }

  const response = await (dependencies.fetcher ?? fetch)(
    dependencies.endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        buildRunRequest({
          storyId,
          text,
          clientMessageId:
            dependencies.createClientMessageId?.() ?? crypto.randomUUID(),
        }),
      ),
      signal,
    },
  );

  if (!response.ok) {
    throw new AssistantRequestError(assistantFailureForStatus(response.status));
  }
  if (!response.body) {
    throw new AssistantRequestError({
      code: "network_error",
      message: "The assistant response did not include a readable stream.",
    });
  }

  yield* readAssistantStream(response.body);
}
