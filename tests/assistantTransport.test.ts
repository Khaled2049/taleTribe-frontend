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
});
