import { useEffect, useMemo, useRef } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { auth } from "@novelsync/platform-auth";
import {
  applyEvent,
  buildRunRequest,
  emptyRunState,
  readAssistantStream,
} from "@novelsync/assistant-contracts";
import { getFunctionUrl } from "@/cloudFunctions";

function SpikeMessage() {
  return (
    <MessagePrimitive.Root
      className="p-3 text-sm whitespace-pre-wrap"
      data-cy="spike-message"
    >
      <MessagePrimitive.Parts />
      <MessagePrimitive.Error>
        <span role="alert">The stream failed. Please try again.</span>
      </MessagePrimitive.Error>
    </MessagePrimitive.Root>
  );
}

/** Development transport harness; the product shell belongs to Phase 4. */
export default function AssistantStreamSpike({
  storyId,
  onClose,
}: {
  storyId: string;
  onClose: () => void;
}) {
  const activeRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async *run({ abortSignal, messages }) {
        const controller = new AbortController();
        activeRequest.current = controller;
        try {
          const user = auth.currentUser;
          if (!user) throw new Error("Sign in to use the assistant");
          const token = await user.getIdToken();
          if (!mounted.current)
            throw new DOMException("Panel closed", "AbortError");
          const endpoint =
            import.meta.env.VITE_ASSISTANT_SPIKE_FIREBASE === "true"
              ? getFunctionUrl("assistantStreamSpike")
              : "/assistant-spike/assistantStreamSpike";
          const last = messages[messages.length - 1];
          const prompt =
            last?.content
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("") || "Hello";
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(
              buildRunRequest({
                storyId,
                text: prompt,
                clientMessageId: crypto.randomUUID(),
              }),
            ),
            signal: AbortSignal.any([abortSignal, controller.signal]),
          });
          if (!response.ok || !response.body)
            throw new Error("Assistant stream unavailable");
          // applyEvent owns the accumulation rule: text.delta appends and
          // text.done settles, so the panel shows what a reload would show.
          let state = emptyRunState();
          for await (const event of readAssistantStream(response.body)) {
            state = applyEvent(state, event);
            if (event.type === "run.failed") {
              throw new Error(event.message);
            }
            if (state.text) {
              yield { content: [{ type: "text", text: state.text }] };
            }
          }
        } finally {
          controller.abort();
          if (activeRequest.current === controller)
            activeRequest.current = null;
        }
      },
    }),
    [storyId],
  );
  const runtime = useLocalRuntime(adapter);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
      runtime.thread.cancelRun();
    };
  }, [runtime]);
  useEffect(
    () =>
      auth.onAuthStateChanged((user) => {
        if (!user) {
          activeRequest.current?.abort();
          runtime.thread.cancelRun();
          onClose();
        }
      }),
    [runtime, onClose],
  );
  const closePreview = () => {
    mounted.current = false;
    activeRequest.current?.abort();
    runtime.thread.cancelRun();
    onClose();
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div
        className="flex flex-col h-full bg-ns-bg text-ns-ink"
        data-cy="assistant-spike"
      >
        <div className="flex justify-between p-4 border-b border-ns-border">
          <span>Assistant transport preview</span>
          <button onClick={closePreview} aria-label="Close assistant preview">
            Close
          </button>
        </div>
        <p className="px-4 py-2 text-xs text-ns-ink-muted">
          Development mock stream
        </p>
        <ThreadPrimitive.Root className="flex flex-col flex-1 min-h-0">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
            <ThreadPrimitive.Messages components={{ Message: SpikeMessage }} />
          </ThreadPrimitive.Viewport>
          <ComposerPrimitive.Root className="p-4 border-t border-ns-border">
            <ComposerPrimitive.Input
              aria-label="Preview message"
              data-cy="spike-input"
              className="w-full bg-ns-bg"
            />
            <ComposerPrimitive.Send data-cy="spike-send">
              Send
            </ComposerPrimitive.Send>
            <ComposerPrimitive.Cancel data-cy="spike-cancel" className="ml-4">
              Stop
            </ComposerPrimitive.Cancel>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
}
