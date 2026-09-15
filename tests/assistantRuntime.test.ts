import { describe, expect, it, vi } from "vitest";
import type { ChatModelRunResult, ThreadMessage } from "@assistant-ui/react";
import {
  createAssistantAdapter,
  editorContinuationForMessage,
} from "@/components/chat/assistantRuntime";
import type { AssistantMessageMetadata } from "@/components/chat/assistantRunModel";
import { EditorActionLedger } from "@/components/chat/editorActionLedger";

const proposal = {
  chapterId: "chapter-1",
  baseRevision: 3,
  baseDocumentVersion: 7,
  summary: "Tighten the image",
  operations: [
    {
      type: "replace",
      from: 1,
      to: 6,
      originalText: "Hello",
      replacementText: "Hail",
    },
  ],
};

function pausedMessage(): ThreadMessage {
  return {
    role: "assistant",
    status: { type: "requires-action", reason: "tool-calls" },
    content: [
      {
        type: "tool-call",
        toolCallId: "proposal-call",
        toolName: "propose_editor_edit",
        args: proposal,
        argsText: JSON.stringify(proposal),
        result: { proposalId: "proposal-1" },
      },
      {
        type: "tool-call",
        toolCallId: "apply-1",
        toolName: "apply_editor_edit",
        args: { proposalId: "proposal-1" },
        argsText: '{"proposalId":"proposal-1"}',
        approval: {
          id: "approval-1",
          approved: true,
        },
      },
    ],
    metadata: {
      custom: { novelsync: { runId: "run-1" } },
    },
  } as unknown as ThreadMessage;
}

describe("assistant approval continuation", () => {
  it("links the exact proposal, approval, prior run, and local save result", () => {
    const ledger = new EditorActionLedger();
    ledger.resolve("approval-1", {
      decision: "applied",
      result: {
        status: "saved",
        chapterId: "chapter-1",
        documentVersion: 8,
        persistedRevision: 4,
      },
    });

    expect(editorContinuationForMessage(pausedMessage(), ledger)).toMatchObject(
      {
        previousRunId: "run-1",
        proposalId: "proposal-1",
        approvalId: "approval-1",
        toolCallId: "apply-1",
        decision: "applied",
        proposal,
        result: { status: "saved" },
      },
    );
  });

  it("fails closed when a resolved approval has no browser action result", () => {
    expect(() =>
      editorContinuationForMessage(pausedMessage(), new EditorActionLedger()),
    ).toThrow(/could not be resumed safely/);
  });
});

describe("local /help command", () => {
  function adapterFor(fetcher: typeof fetch, editsEnabled = true) {
    return createAssistantAdapter({
      storyId: "story-1",
      activeRequest: { current: null },
      actionLedger: new EditorActionLedger(),
      editsEnabled,
      transport: {
        endpoint: "/assistant-run/assistantRun",
        getIdToken: async () => "firebase-token",
        fetcher,
      },
    });
  }

  function userMessage(text: string): ThreadMessage {
    return {
      role: "user",
      content: [{ type: "text", text }],
    } as unknown as ThreadMessage;
  }

  const emptyAssistantMessage = {
    role: "assistant",
    status: { type: "running" },
    content: [],
    metadata: { custom: {} },
  } as unknown as ThreadMessage;

  async function runAdapter(
    adapter: ReturnType<typeof createAssistantAdapter>,
    text: string,
    current: ThreadMessage = emptyAssistantMessage,
  ) {
    // `run` is typed as a promise *or* a generator; this adapter always
    // returns the generator, and the test drives it as one.
    const stream = adapter.run({
      abortSignal: new AbortController().signal,
      messages: [userMessage(text)],
      unstable_getMessage: () => current,
    } as never) as AsyncGenerator<ChatModelRunResult>;
    const results: ChatModelRunResult[] = [];
    for await (const result of stream) results.push(result);
    return results;
  }

  it("answers /help without touching the network", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("the help command must not reach the server");
    }) as unknown as typeof fetch;

    const results = await runAdapter(adapterFor(fetcher), "  /HELP ");

    expect(fetcher).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    const metadata = results[0].metadata?.custom
      ?.novelsync as AssistantMessageMetadata;
    expect(metadata.kind).toBe("local_help");
    expect(metadata.runId).toBeNull();
    expect(metadata.usage.modelCalls).toBe(0);
    expect(results[0].status).toEqual({ type: "complete", reason: "stop" });
    expect(metadata.help?.capabilities.length).toBeGreaterThan(0);
  });

  it("hides the edit capability when the server flag is off", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const [enabled] = await runAdapter(adapterFor(fetcher, true), "/help");
    const [disabled] = await runAdapter(adapterFor(fetcher, false), "/help");
    const gates = (result: (typeof enabled)["metadata"]) =>
      (
        result?.custom?.novelsync as AssistantMessageMetadata
      ).help?.capabilities.map((capability) => capability.gate) ?? [];

    expect(gates(enabled.metadata)).toContain("edits");
    expect(gates(disabled.metadata)).not.toContain("edits");
    // research_web has no executor and run.py hardcodes it off, so it is never
    // listed regardless of the edit flag.
    expect(gates(enabled.metadata)).not.toContain("research");
  });

  it("never lists a tool the run loop would not offer", async () => {
    const [result] = await runAdapter(
      adapterFor(vi.fn() as unknown as typeof fetch),
      "/help",
    );
    const metadata = result.metadata?.custom
      ?.novelsync as AssistantMessageMetadata;
    const described = (metadata.help?.capabilities ?? []).flatMap(
      (capability) => capability.tools,
    );
    expect(described).not.toContain("research_web");
    expect(described).toContain("search_story");
  });

  it("sends a prompt that merely starts with a slash to the assistant", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"v":1,"runId":"r","seq":0,"type":"run.cancelled"}\n\n',
                ),
              );
              controller.close();
            },
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    await runAdapter(adapterFor(fetcher), "/help me tighten this paragraph");

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("resumes an approval rather than reading it as a command", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"v":1,"runId":"r","seq":0,"type":"run.cancelled"}\n\n',
                ),
              );
              controller.close();
            },
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const ledger = new EditorActionLedger();
    ledger.resolve("approval-1", { decision: "rejected" });
    const adapter = createAssistantAdapter({
      storyId: "story-1",
      activeRequest: { current: null },
      actionLedger: ledger,
      editsEnabled: true,
      transport: {
        endpoint: "/assistant-run/assistantRun",
        getIdToken: async () => "firebase-token",
        fetcher,
      },
    });

    await runAdapter(adapter, "/help", pausedMessage());

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
