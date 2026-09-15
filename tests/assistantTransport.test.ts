import { describe, expect, it, vi } from "vitest";
import type { ThreadMessage } from "@assistant-ui/react";
import {
  AssistantRequestError,
  latestUserText,
  streamAssistantRun,
} from "@/components/chat/assistantTransport";

function streamOf(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

describe("assistant browser transport", () => {
  it("extracts only the latest user text from a local transcript", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "first" }] },
      { role: "assistant", content: [{ type: "text", text: "answer" }] },
      { role: "user", content: [{ type: "text", text: "latest" }] },
    ] as unknown as ThreadMessage[];
    expect(latestUserText(messages)).toBe("latest");
  });

  it("sends the authenticated v1 shape without identity, history, or secrets", async () => {
    let request: RequestInit | undefined;
    const fetcher = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        request = init;
        return new Response(
          streamOf(
            'data: {"v":1,"runId":"r","seq":0,"type":"run.cancelled"}\n\n',
          ),
          { status: 200 },
        );
      },
    ) as typeof fetch;

    await collect(
      streamAssistantRun(
        "story-1",
        "What is the premise?",
        new AbortController().signal,
        {
          endpoint: "/assistant-run/assistantRun",
          getIdToken: async () => "firebase-token",
          createClientMessageId: () => "client-1",
          fetcher,
        },
      ),
    );

    const body = JSON.parse(String(request?.body));
    expect(body).toEqual({
      v: 1,
      storyId: "story-1",
      clientMessageId: "client-1",
      message: {
        role: "user",
        parts: [{ type: "text", text: "What is the premise?" }],
      },
    });
    expect(body).not.toHaveProperty("userId");
    expect(body).not.toHaveProperty("messages");
    expect(JSON.stringify(body)).not.toMatch(/token|secret|provider/i);
    expect((request?.headers as Record<string, string>).Authorization).toBe(
      "Bearer firebase-token",
    );
  });

  it("includes the durable thread identity in the run request", async () => {
    let body: Record<string, unknown> = {};
    const getThreadId = vi.fn(async () => "thread-1");

    await collect(
      streamAssistantRun(
        "story-1",
        "Continue the scene",
        new AbortController().signal,
        {
          endpoint: "/assistant",
          getIdToken: async () => "token",
          getThreadId,
          fetcher: vi.fn(async (_url, init) => {
            body = JSON.parse(String(init?.body));
            return new Response(
              streamOf(
                'data: {"v":1,"runId":"r","seq":0,"type":"run.cancelled"}\n\n',
              ),
            );
          }) as typeof fetch,
        },
      ),
    );

    expect(getThreadId).toHaveBeenCalledOnce();
    expect(body.threadId).toBe("thread-1");
  });

  it("aborts while authentication is still resolving", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn() as unknown as typeof fetch;
    const run = collect(
      streamAssistantRun("story-1", "Hello", controller.signal, {
        endpoint: "/assistant",
        getIdToken: () => new Promise(() => undefined),
        fetcher,
      }),
    );
    controller.abort();

    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps pre-stream HTTP status without exposing an upstream body", async () => {
    const run = collect(
      streamAssistantRun("story-1", "Hello", new AbortController().signal, {
        endpoint: "/assistant",
        getIdToken: async () => "token",
        fetcher: vi.fn(
          async () => new Response("private upstream detail", { status: 429 }),
        ) as typeof fetch,
      }),
    );
    await expect(run).rejects.toMatchObject({
      name: "AssistantRequestError",
      failure: { code: "rate_limited", message: expect.any(String) },
    } satisfies Partial<AssistantRequestError>);
    await expect(run).rejects.not.toThrow(/private upstream detail/);
  });

  it("retries one transient gateway failure before reading the stream", async () => {
    const fetcherMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{"error":{"code":"provider_unavailable"}}', {
          status: 502,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          streamOf(
            'data: {"v":1,"runId":"recovered","seq":0,"type":"run.cancelled"}\n\n',
          ),
          { status: 200 },
        ),
      );
    const fetcher = fetcherMock as typeof fetch;

    const events = await collect(
      streamAssistantRun("story-1", "Hello", new AbortController().signal, {
        endpoint: "/assistant",
        getIdToken: async () => "token",
        createClientMessageId: () => "client-1",
        fetcher,
      }),
    );

    expect(fetcherMock).toHaveBeenCalledTimes(2);
    expect(
      fetcherMock.mock.calls.map((call) =>
        JSON.parse(String((call[1] as RequestInit).body)),
      ),
    ).toEqual([
      expect.objectContaining({ clientMessageId: "client-1" }),
      expect.objectContaining({ clientMessageId: "client-1" }),
    ]);
    expect(events).toHaveLength(1);
  });

  it("uses a fresh client message identity for every retry", async () => {
    const bodies: Array<{ clientMessageId: string }> = [];
    let nextId = 0;
    const fetcher = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response(
          streamOf(
            'data: {"v":1,"runId":"r","seq":0,"type":"run.cancelled"}\n\n',
          ),
        );
      },
    ) as typeof fetch;
    const dependencies = {
      endpoint: "/assistant",
      getIdToken: async () => "token",
      createClientMessageId: () => `client-${++nextId}`,
      fetcher,
    };

    await collect(
      streamAssistantRun(
        "story-1",
        "Hello",
        new AbortController().signal,
        dependencies,
      ),
    );
    await collect(
      streamAssistantRun(
        "story-1",
        "Hello",
        new AbortController().signal,
        dependencies,
      ),
    );
    expect(bodies.map((body) => body.clientMessageId)).toEqual([
      "client-1",
      "client-2",
    ]);
  });

  it("captures a fresh bounded editor snapshot for a normal send", async () => {
    let body: Record<string, unknown> = {};
    const prepareEditorContext = vi.fn(async () => ({
      chapterId: "chapter-1",
      persistedRevision: 3,
      documentVersion: 7,
      selection: { from: 1, to: 6, text: "Hello" },
      buffer: { text: "Hello world", truncated: false },
      dirty: false,
    }));
    await collect(
      streamAssistantRun(
        "story-1",
        "Tighten it",
        new AbortController().signal,
        {
          endpoint: "/assistant",
          getIdToken: async () => "token",
          prepareEditorContext,
          fetcher: vi.fn(async (_url, init) => {
            body = JSON.parse(String(init?.body));
            return new Response(
              streamOf(
                'data: {"v":1,"runId":"r","seq":0,"type":"run.cancelled"}\n\n',
              ),
            );
          }) as typeof fetch,
        },
      ),
    );
    expect(prepareEditorContext).toHaveBeenCalledWith("send");
    expect(body.editorContext).toMatchObject({
      chapterId: "chapter-1",
      selection: { text: "Hello" },
    });
  });

  it("sends a typed approval continuation and uses continuation snapshot mode", async () => {
    let body: Record<string, unknown> = {};
    const proposal = {
      chapterId: "chapter-1",
      baseRevision: 3,
      baseDocumentVersion: 7,
      summary: "Tighten it",
      operations: [
        {
          type: "replace" as const,
          from: 1,
          to: 6,
          originalText: "Hello",
          replacementText: "Hi",
        },
      ],
    };
    const prepareEditorContext = vi.fn(async () => null);
    await collect(
      streamAssistantRun(
        "story-1",
        "Tighten it",
        new AbortController().signal,
        {
          endpoint: "/assistant",
          getIdToken: async () => "token",
          prepareEditorContext,
          fetcher: vi.fn(async (_url, init) => {
            body = JSON.parse(String(init?.body));
            return new Response(
              streamOf(
                'data: {"v":1,"runId":"r2","seq":0,"type":"run.cancelled"}\n\n',
              ),
            );
          }) as typeof fetch,
        },
        {
          continuation: {
            kind: "editor_approval",
            previousRunId: "r1",
            approvalId: "approval-1",
            toolCallId: "apply-1",
            proposalId: "proposal-1",
            decision: "applied",
            proposal,
            result: {
              status: "saved",
              chapterId: "chapter-1",
              documentVersion: 8,
              persistedRevision: 4,
            },
          },
        },
      ),
    );
    expect(prepareEditorContext).toHaveBeenCalledWith("continuation");
    expect(body.continuation).toMatchObject({
      previousRunId: "r1",
      decision: "applied",
      result: { status: "saved" },
    });
  });
});
