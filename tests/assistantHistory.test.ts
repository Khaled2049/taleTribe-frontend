import type { ExportedMessageRepositoryItem } from "@assistant-ui/react";
import { describe, expect, it, vi } from "vitest";
import {
  AssistantThreadSession,
  conversationKey,
  titleFromMessage,
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
    updateThread: vi.fn(async (_storyId, current, patch) => ({
      ...current,
      ...patch,
      revision: current.revision + 1,
    })),
    getThread: vi.fn(async (_storyId, threadId) => ({
      ...thread,
      id: threadId,
      title: `Thread ${threadId}`,
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

describe("titleFromMessage", () => {
  it("uses the opening line verbatim when it is short", () => {
    expect(titleFromMessage("Where is the key?")).toBe("Where is the key?");
  });

  it("collapses whitespace and takes only the first non-empty line", () => {
    expect(titleFromMessage("\n\n  Who   is  Mina?  \nAnd Tam?")).toBe(
      "Who is Mina?",
    );
  });

  it("truncates on a word boundary", () => {
    const title = titleFromMessage(
      "Please rewrite the opening paragraph of the lighthouse chapter so it lands harder",
    );
    expect(title).toBe(
      "Please rewrite the opening paragraph of the lighthouse...",
    );
    expect(title!.length).toBeLessThanOrEqual(63);
  });

  it("returns null for text with nothing in it", () => {
    expect(titleFromMessage("   \n  ")).toBeNull();
  });
});

describe("thread naming", () => {
  it("names a new thread from the first user message", async () => {
    const repo = repository();
    const session = new AssistantThreadSession("story-1", repo);

    await session.history().append(userItem);

    expect(repo.updateThread).toHaveBeenCalledWith(
      "story-1",
      expect.objectContaining({ id: "thread-1" }),
      { title: "Where is the key?" },
    );
  });

  it("does not rename a thread that already has a title", async () => {
    const named: AssistantThread = { ...thread, title: "Where is the key?" };
    const repo = repository({
      listThreads: vi.fn(async () => ({ threads: [named] })),
    });
    const session = new AssistantThreadSession("story-1", repo);

    await session.history().append({
      ...userItem,
      message: {
        ...userItem.message,
        id: "local-user-2",
        content: [{ type: "text", text: "A second question entirely" }],
      },
    } as ExportedMessageRepositoryItem);

    expect(repo.updateThread).not.toHaveBeenCalled();
  });

  it("does not name a thread from an assistant message", async () => {
    const repo = repository();
    const session = new AssistantThreadSession("story-1", repo);

    await session.history().append({
      ...userItem,
      message: {
        ...userItem.message,
        role: "assistant",
        content: [{ type: "text", text: "The key is under the mat." }],
      },
    } as ExportedMessageRepositoryItem);

    expect(repo.updateThread).not.toHaveBeenCalled();
  });

  it("keeps the message when renaming fails", async () => {
    const repo = repository({
      updateThread: vi.fn(async () => {
        throw new Error("precondition failed");
      }),
    });
    const session = new AssistantThreadSession("story-1", repo);

    await expect(session.history().append(userItem)).resolves.toBeUndefined();
    expect(repo.appendMessage).toHaveBeenCalled();
  });
});

describe("conversation targeting", () => {
  const older: AssistantThread = {
    ...thread,
    id: "thread-0",
    title: "An older chat",
  };

  it("opens the most recent thread by default", async () => {
    const repo = repository({
      listThreads: vi.fn(async () => ({ threads: [older, thread] })),
    });
    const session = new AssistantThreadSession("story-1", repo);

    await expect(session.loadExisting()).resolves.toMatchObject({
      id: "thread-0",
    });
    expect(repo.getThread).not.toHaveBeenCalled();
  });

  it("opens a named thread without consulting the listing", async () => {
    const repo = repository();
    const session = new AssistantThreadSession("story-1", repo, {
      mode: "thread",
      threadId: "thread-7",
    });

    await expect(session.loadExisting()).resolves.toMatchObject({
      id: "thread-7",
    });
    expect(repo.listThreads).not.toHaveBeenCalled();
  });

  it("falls back to an empty transcript when a named thread is gone", async () => {
    const repo = repository({
      getThread: vi.fn(async () => {
        throw new Error("404");
      }),
    });
    const session = new AssistantThreadSession("story-1", repo, {
      mode: "thread",
      threadId: "deleted",
    });

    await expect(session.loadExisting()).resolves.toBeNull();
  });

  it("starts a new conversation empty and creates nothing until a message arrives", async () => {
    const repo = repository({
      listThreads: vi.fn(async () => ({ threads: [older] })),
    });
    const session = new AssistantThreadSession("story-1", repo, {
      mode: "new",
      nonce: 1,
    });

    await expect(session.history().load()).resolves.toEqual({ messages: [] });
    expect(repo.createThread).not.toHaveBeenCalled();
    expect(repo.listThreads).not.toHaveBeenCalled();

    await session.history().append(userItem);
    expect(repo.createThread).toHaveBeenCalledWith("story-1");
  });

  it("lists only unarchived threads", async () => {
    const archived: AssistantThread = {
      ...thread,
      id: "thread-9",
      archivedAt: date,
    };
    const repo = repository({
      listThreads: vi.fn(async () => ({ threads: [thread, archived] })),
    });
    const session = new AssistantThreadSession("story-1", repo);

    await expect(session.listThreads()).resolves.toEqual([thread]);
  });

  it("archives a thread through the revision-tracking repo", async () => {
    const repo = repository();
    const session = new AssistantThreadSession("story-1", repo);

    await session.archive(thread);

    expect(repo.updateThread).toHaveBeenCalledWith("story-1", thread, {
      archived: true,
    });
  });
});

describe("conversationKey", () => {
  it("distinguishes every target, so switching remounts the runtime", () => {
    expect(conversationKey({ mode: "latest" })).toBe("latest");
    expect(conversationKey({ mode: "thread", threadId: "a" })).toBe("thread:a");
    expect(conversationKey({ mode: "thread", threadId: "b" })).not.toBe(
      conversationKey({ mode: "thread", threadId: "a" }),
    );
  });

  it("gives consecutive new conversations different keys", () => {
    expect(conversationKey({ mode: "new", nonce: 1 })).not.toBe(
      conversationKey({ mode: "new", nonce: 2 }),
    );
  });
});
