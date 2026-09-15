import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssistantThreadRepo,
  configureStoryData,
  type AssistantMessage,
  type AssistantThread,
} from "@novelsync/story-data-client";

const now = "2026-09-14T12:00:00Z";
const later = "2026-09-14T12:01:00Z";

const apiThread = (revision = 1) => ({
  id: "thread-1",
  storyId: "story-1",
  title: "Opening questions",
  revision,
  messageCount: 0,
  createdAt: now,
  updatedAt: later,
});

const apiMessage = (revision = 1) => ({
  id: "message-1",
  threadId: "thread-1",
  sequence: 1,
  role: "assistant" as const,
  parts: [{ type: "text", text: "The key is beneath the cup." }],
  status: "complete" as const,
  metadata: { finishReason: "stop" },
  idempotencyKey: "run-1:assistant",
  runId: "run-1",
  revision,
  createdAt: now,
  updatedAt: later,
});

beforeEach(() => {
  configureStoryData({
    baseUrl: "https://story-data.test",
    sendDevUserHeader: false,
    getAuthContext: async () => ({ uid: "u1", token: "token" }),
    getUid: () => "u1",
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("AssistantThreadRepo", () => {
  it("lists and maps durable thread timestamps", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ threads: [apiThread()], nextCursor: "next page" }),
    });
    vi.stubGlobal("fetch", fetcher);

    const page = await new AssistantThreadRepo().listThreads(
      "story-1",
      "current page",
      12,
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://story-data.test/v1/stories/story-1/assistant-threads?cursor=current+page&limit=12",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
    expect(page.nextCursor).toBe("next page");
    expect(page.threads[0]?.createdAt).toEqual(new Date(now));
    expect(page.threads[0]?.updatedAt).toEqual(new Date(later));
  });

  it("uses the latest cached revisions for thread and message updates", async () => {
    const replies = [apiThread(2), apiThread(3), apiMessage(4), apiMessage(5)];
    const calls: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(init);
        return {
          ok: true,
          status: 200,
          json: async () => replies.shift(),
        };
      }),
    );
    const repo = new AssistantThreadRepo();
    const thread = {
      ...apiThread(),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    } satisfies AssistantThread;
    const message = {
      ...apiMessage(),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    } satisfies AssistantMessage;

    await repo.updateThread("story-1", thread, { title: "Renamed once" });
    await repo.updateThread("story-1", thread, { title: "Renamed twice" });
    await repo.updateMessage("story-1", "thread-1", message, {
      parts: message.parts,
      status: "complete",
    });
    await repo.updateMessage("story-1", "thread-1", message, {
      parts: message.parts,
      status: "complete",
    });

    expect(calls[0]?.headers).toMatchObject({ "If-Match": "1" });
    expect(calls[1]?.headers).toMatchObject({ "If-Match": "2" });
    expect(calls[2]?.headers).toMatchObject({ "If-Match": "1" });
    expect(calls[3]?.headers).toMatchObject({ "If-Match": "4" });
  });

  it("appends structured message parts with a stable idempotency key", async () => {
    let body: unknown;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return { ok: true, status: 201, json: async () => apiMessage() };
      }),
    );

    await new AssistantThreadRepo().appendMessage("story-1", "thread-1", {
      role: "assistant",
      parts: [{ type: "text", text: "Answer" }],
      status: "complete",
      metadata: { usage: { credits: 2 } },
      idempotencyKey: "run-1:assistant",
      runId: "run-1",
    });

    expect(body).toMatchObject({
      role: "assistant",
      idempotencyKey: "run-1:assistant",
      runId: "run-1",
      parts: [{ type: "text", text: "Answer" }],
    });
  });
});
