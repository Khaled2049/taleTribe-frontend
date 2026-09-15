import type {
  ExportedMessageRepository,
  ExportedMessageRepositoryItem,
  ThreadHistoryAdapter,
  ThreadMessage,
} from "@assistant-ui/react";
import {
  assistantThreadRepo,
  type AssistantMessage,
  type AssistantMessageStatus,
  type AssistantThread,
  type AssistantThreadPage,
  type AssistantMessagePage,
} from "@novelsync/story-data-client";

const STORAGE_VERSION = 1;
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

export type ThreadRepository = {
  listThreads(
    storyId: string,
    cursor?: string,
    limit?: number,
  ): Promise<AssistantThreadPage>;
  createThread(storyId: string, title?: string): Promise<AssistantThread>;
  listMessages(
    storyId: string,
    threadId: string,
    cursor?: string,
    limit?: number,
  ): Promise<AssistantMessagePage>;
  appendMessage(
    storyId: string,
    threadId: string,
    input: {
      role: "user" | "assistant";
      parts: unknown[];
      status?: AssistantMessageStatus;
      metadata?: Record<string, unknown>;
      idempotencyKey: string;
      runId?: string;
    },
  ): Promise<AssistantMessage>;
  updateMessage(
    storyId: string,
    threadId: string,
    message: AssistantMessage,
    patch: {
      parts: unknown[];
      status: AssistantMessageStatus;
      metadata?: Record<string, unknown>;
    },
  ): Promise<AssistantMessage>;
};

type StoredAssistantUI = {
  version: number;
  localMessageId: string;
  parentId: string | null;
  createdAt: string;
  metadata: ThreadMessage["metadata"];
  attachments?: ThreadMessage["attachments"];
  status?: ThreadMessage["status"];
  runConfig?: ExportedMessageRepositoryItem["runConfig"];
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function storedUI(message: AssistantMessage): StoredAssistantUI | null {
  const value = record(message.metadata.assistantUi);
  if (
    !value ||
    value.version !== STORAGE_VERSION ||
    typeof value.localMessageId !== "string" ||
    (value.parentId !== null && typeof value.parentId !== "string") ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }
  return value as StoredAssistantUI;
}

function defaultMetadata(
  role: "user" | "assistant",
): ThreadMessage["metadata"] {
  if (role === "user") return { custom: {} };
  return {
    unstable_state: null,
    unstable_annotations: [],
    unstable_data: [],
    steps: [],
    custom: {},
  };
}

function defaultStatus(message: AssistantMessage): ThreadMessage["status"] {
  switch (message.status) {
    case "requires_action":
      return { type: "requires-action", reason: "tool-calls" };
    case "cancelled":
      return { type: "incomplete", reason: "cancelled" };
    case "failed":
      return { type: "incomplete", reason: "error" };
    case "incomplete":
      return { type: "incomplete", reason: "other" };
    default:
      return { type: "complete", reason: "unknown" };
  }
}

function toRepositoryItem(
  message: AssistantMessage,
): ExportedMessageRepositoryItem {
  const stored = storedUI(message);
  const common = {
    id: stored?.localMessageId ?? message.id,
    createdAt: stored ? new Date(stored.createdAt) : message.createdAt,
    content: message.parts as ThreadMessage["content"],
    metadata: stored?.metadata ?? defaultMetadata(message.role),
  };
  const hydrated: ThreadMessage =
    message.role === "user"
      ? ({
          ...common,
          role: "user",
          attachments: stored?.attachments ?? [],
        } as ThreadMessage)
      : ({
          ...common,
          role: "assistant",
          status: stored?.status ?? defaultStatus(message),
        } as ThreadMessage);
  return {
    message: hydrated,
    parentId: stored?.parentId ?? null,
    runConfig: stored?.runConfig,
  };
}

function databaseStatus(message: ThreadMessage): AssistantMessageStatus {
  if (message.role !== "assistant" || !message.status) return "complete";
  if (message.status.type === "requires-action") return "requires_action";
  if (message.status.type === "complete") return "complete";
  if (message.status.type === "running") return "incomplete";
  if (message.status.reason === "cancelled") return "cancelled";
  if (message.status.reason === "error") return "failed";
  return "incomplete";
}

function runId(message: ThreadMessage): string | undefined {
  const novelsync = record(message.metadata.custom?.novelsync);
  return typeof novelsync?.runId === "string" ? novelsync.runId : undefined;
}

function serialize(item: ExportedMessageRepositoryItem) {
  const message = item.message;
  const assistantUi: StoredAssistantUI = {
    version: STORAGE_VERSION,
    localMessageId: message.id,
    parentId: item.parentId,
    createdAt: message.createdAt.toISOString(),
    metadata: message.metadata,
    attachments: message.attachments,
    status: message.status,
    runConfig: item.runConfig,
  };
  return {
    role: message.role as "user" | "assistant",
    parts: [...message.content] as unknown[],
    status: databaseStatus(message),
    metadata: { assistantUi },
    idempotencyKey: message.id,
    runId: runId(message),
  };
}

export class AssistantThreadSession {
  private existing: Promise<AssistantThread | null> | null = null;
  private thread: AssistantThread | null = null;

  constructor(
    readonly storyId: string,
    private readonly repository: ThreadRepository = assistantThreadRepo,
  ) {}

  async loadExisting(): Promise<AssistantThread | null> {
    if (!this.existing) {
      this.existing = this.repository
        .listThreads(this.storyId, undefined, PAGE_SIZE)
        .then(
          (page) => page.threads.find((thread) => !thread.archivedAt) ?? null,
        )
        .then((thread) => (this.thread = thread));
    }
    return this.existing;
  }

  async ensureThread(): Promise<AssistantThread> {
    const existing = this.thread ?? (await this.loadExisting());
    if (existing) return existing;
    this.thread = await this.repository.createThread(this.storyId);
    this.existing = Promise.resolve(this.thread);
    return this.thread;
  }

  async threadId(): Promise<string> {
    return (await this.ensureThread()).id;
  }

  history(): ThreadHistoryAdapter {
    const persisted = new Map<string, AssistantMessage>();

    const loadAll = async (thread: AssistantThread) => {
      const messages: AssistantMessage[] = [];
      let cursor: string | undefined;
      for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber += 1) {
        const page = await this.repository.listMessages(
          this.storyId,
          thread.id,
          cursor,
          PAGE_SIZE,
        );
        messages.push(...page.messages);
        if (!page.nextCursor) return messages;
        cursor = page.nextCursor;
      }
      throw new Error(
        "Assistant history exceeded the pagination safety limit.",
      );
    };

    const findPersisted = async (
      localMessageId: string,
    ): Promise<AssistantMessage | undefined> => {
      const known = persisted.get(localMessageId);
      if (known) return known;
      const thread = await this.loadExisting();
      if (!thread) return undefined;
      const messages = await loadAll(thread);
      for (const message of messages) {
        const localId = storedUI(message)?.localMessageId ?? message.id;
        persisted.set(localId, message);
      }
      return persisted.get(localMessageId);
    };

    return {
      load: async (): Promise<ExportedMessageRepository> => {
        const thread = await this.loadExisting();
        if (!thread) return { messages: [] };
        const messages = await loadAll(thread);
        const items = messages.map((message) => {
          const item = toRepositoryItem(message);
          persisted.set(item.message.id, message);
          return item;
        });
        return {
          headId: items.at(-1)?.message.id ?? null,
          messages: items,
        };
      },
      append: async (item) => {
        if (item.message.role === "system") return;
        const thread = await this.ensureThread();
        const message = await this.repository.appendMessage(
          this.storyId,
          thread.id,
          serialize(item),
        );
        persisted.set(item.message.id, message);
      },
      update: async (item) => {
        if (item.message.role !== "assistant") return;
        const thread = await this.ensureThread();
        const current = await findPersisted(item.message.id);
        if (!current) {
          const created = await this.repository.appendMessage(
            this.storyId,
            thread.id,
            serialize(item),
          );
          persisted.set(item.message.id, created);
          return;
        }
        const serialized = serialize(item);
        const updated = await this.repository.updateMessage(
          this.storyId,
          thread.id,
          current,
          {
            parts: serialized.parts,
            status: serialized.status,
            metadata: serialized.metadata,
          },
        );
        persisted.set(item.message.id, updated);
      },
    };
  }
}
