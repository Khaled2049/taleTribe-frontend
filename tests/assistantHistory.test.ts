import type { ExportedMessageRepositoryItem } from "@assistant-ui/react";
import { describe, expect, it, vi } from "vitest";
import {
  AssistantThreadSession,
  type ThreadRepository,
} from "@/components/chat/assistantHistory";
import type {
  AssistantMessage,
  AssistantThread,
} from "@novelsync/story-data-client";

const date = new Date("2026-09-14T12:00:00Z");
const thread: AssistantThread = {
  id: "thread-1",
  storyId: "story-1",
  title: "New conversation",
  revision: 1,
  messageCount: 0,
  createdAt: date,
  updatedAt: date,
};

function repository(
  overrides: Partial<ThreadRepository> = {},
): ThreadRepository {
  return {
    listThreads: vi.fn(async () => ({ threads: [] })),
    createThread: vi.fn(async () => thread),
    listMessages: vi.fn(async () => ({ messages: [] })),
    appendMessage: vi.fn(async (_storyId, threadId, input) => ({
      id: "stored-1",
      threadId,
      sequence: 1,
      ...input,
      status: input.status ?? "complete",
      metadata: input.metadata ?? {},
      revision: 1,
      createdAt: date,
      updatedAt: date,
    })),
    updateMessage: vi.fn(async (_storyId, _threadId, message, patch) => ({
      ...message,
      ...patch,
      metadata: patch.metadata ?? {},
      revision: message.revision + 1,
    })),
    ...overrides,
  };
}

const userItem: ExportedMessageRepositoryItem = {
  parentId: null,
  message: {
    id: "local-user-1",
    role: "user",
    content: [{ type: "text", text: "Where is the key?" }],
    attachments: [],
    createdAt: date,
    metadata: { custom: {} },
  },
};

describe("AssistantThreadSession", () => {
  it("does not create an empty thread until the first message is appended", async () => {
    const repo = repository();
    const session = new AssistantThreadSession("story-1", repo);
    const history = session.history();

    await expect(history.load()).resolves.toEqual({ messages: [] });
    expect(repo.createThread).not.toHaveBeenCalled();

    await history.append(userItem);
    expect(repo.createThread).toHaveBeenCalledWith("story-1");
    expect(repo.appendMessage).toHaveBeenCalledWith(
      "story-1",
      "thread-1",
      expect.objectContaining({
        role: "user",
        parts: [{ type: "text", text: "Where is the key?" }],
        idempotencyKey: "local-user-1",
      }),
    );
    await expect(session.threadId()).resolves.toBe("thread-1");
  });

  it("rehydrates structured parts, parent linkage, and approval status", async () => {
    const stored: AssistantMessage = {
      id: "stored-2",
      threadId: "thread-1",
      sequence: 2,
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolName: "apply_editor_edit",
          toolCallId: "apply-1",
          args: { proposalId: "proposal-1" },
        },
      ],
      status: "requires_action",
      metadata: {
        assistantUi: {
          version: 1,
          localMessageId: "local-assistant-1",
          parentId: "local-user-1",
          createdAt: date.toISOString(),
          metadata: {
            unstable_state: null,
            unstable_annotations: [],
            unstable_data: [],
            steps: [],
            custom: { novelsync: { runId: "run-1" } },
          },
          status: { type: "requires-action", reason: "tool-calls" },
        },
      },
      idempotencyKey: "local-assistant-1",
      runId: "run-1",
      revision: 1,
      createdAt: date,
      updatedAt: date,
    };
    const repo = repository({
      listThreads: vi.fn(async () => ({ threads: [thread] })),
      listMessages: vi.fn(async () => ({ messages: [stored] })),
    });

    const loaded = await new AssistantThreadSession("story-1", repo)
      .history()
      .load();

    expect(loaded.headId).toBe("local-assistant-1");
    expect(loaded.messages[0]?.parentId).toBe("local-user-1");
    expect(loaded.messages[0]?.message).toMatchObject({
      id: "local-assistant-1",
      role: "assistant",
      content: stored.parts,
      status: { type: "requires-action", reason: "tool-calls" },
    });
  });

  it("updates the same durable assistant message when an approval resolves", async () => {
    const repo = repository();
    const session = new AssistantThreadSession("story-1", repo);
    const history = session.history();
    const assistant: ExportedMessageRepositoryItem = {
      parentId: "local-user-1",
      message: {
        id: "local-assistant-1",
        role: "assistant",
        content: [{ type: "text", text: "Apply this edit?" }],
        status: { type: "requires-action", reason: "tool-calls" },
        createdAt: date,
        metadata: {
          unstable_state: null,
          unstable_annotations: [],
          unstable_data: [],
          steps: [],
          custom: { novelsync: { runId: "run-1" } },
        },
      },
    };

    await history.append(assistant);
    const resolved: ExportedMessageRepositoryItem = {
      ...assistant,
      message: {
        ...assistant.message,
        content: [{ type: "text" as const, text: "Applied and saved." }],
        status: { type: "complete" as const, reason: "stop" as const },
      },
    };
    await history.update?.(resolved);

    expect(repo.updateMessage).toHaveBeenCalledWith(
      "story-1",
      "thread-1",
      expect.objectContaining({ id: "stored-1" }),
      expect.objectContaining({
        parts: [{ type: "text", text: "Applied and saved." }],
        status: "complete",
      }),
    );
  });
});
