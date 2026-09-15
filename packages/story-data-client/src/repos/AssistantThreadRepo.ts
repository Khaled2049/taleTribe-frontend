import { request } from "../request";

export type AssistantMessageStatus =
  "incomplete" | "complete" | "requires_action" | "failed" | "cancelled";

export interface AssistantThread {
  id: string;
  storyId: string;
  title: string;
  revision: number;
  archivedAt?: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantMessage {
  id: string;
  threadId: string;
  sequence: number;
  role: "user" | "assistant";
  parts: unknown[];
  status: AssistantMessageStatus;
  metadata: Record<string, unknown>;
  idempotencyKey: string;
  runId?: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  idempotentReplay?: boolean;
}

export interface AssistantThreadPage {
  threads: AssistantThread[];
  nextCursor?: string;
}

export interface AssistantMessagePage {
  messages: AssistantMessage[];
  nextCursor?: string;
}

interface ApiAssistantThread extends Omit<
  AssistantThread,
  "archivedAt" | "createdAt" | "updatedAt"
> {
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiAssistantMessage extends Omit<
  AssistantMessage,
  "createdAt" | "updatedAt"
> {
  createdAt: string;
  updatedAt: string;
}

function query(cursor?: string, limit?: number): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit !== undefined) params.set("limit", String(limit));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export class AssistantThreadRepo {
  private revisions = new Map<string, number>();

  private base(storyId: string): string {
    return `/v1/stories/${storyId}/assistant-threads`;
  }

  private thread(api: ApiAssistantThread): AssistantThread {
    this.revisions.set(`thread:${api.id}`, api.revision);
    return {
      ...api,
      archivedAt: api.archivedAt ? new Date(api.archivedAt) : undefined,
      createdAt: new Date(api.createdAt),
      updatedAt: new Date(api.updatedAt),
    };
  }

  private message(api: ApiAssistantMessage): AssistantMessage {
    this.revisions.set(`message:${api.id}`, api.revision);
    return {
      ...api,
      createdAt: new Date(api.createdAt),
      updatedAt: new Date(api.updatedAt),
    };
  }

  async listThreads(
    storyId: string,
    cursor?: string,
    limit?: number,
  ): Promise<AssistantThreadPage> {
    const page = await request<{
      threads: ApiAssistantThread[];
      nextCursor?: string;
    }>(`${this.base(storyId)}${query(cursor, limit)}`, {
      auth: "required",
      label: "Assistant threads request",
    });
    return {
      ...page,
      threads: page.threads.map((thread) => this.thread(thread)),
    };
  }

  async createThread(
    storyId: string,
    title?: string,
  ): Promise<AssistantThread> {
    const thread = await request<ApiAssistantThread>(this.base(storyId), {
      method: "POST",
      body: title ? { title } : {},
      auth: "required",
      label: "Assistant thread request",
    });
    return this.thread(thread);
  }

  async getThread(storyId: string, threadId: string): Promise<AssistantThread> {
    return this.thread(
      await request<ApiAssistantThread>(`${this.base(storyId)}/${threadId}`, {
        auth: "required",
        label: "Assistant thread request",
      }),
    );
  }

  async updateThread(
    storyId: string,
    thread: AssistantThread,
    patch: { title?: string; archived?: boolean },
  ): Promise<AssistantThread> {
    const revision =
      this.revisions.get(`thread:${thread.id}`) ?? thread.revision;
    return this.thread(
      await request<ApiAssistantThread>(`${this.base(storyId)}/${thread.id}`, {
        method: "PATCH",
        body: patch,
        revision,
        auth: "required",
        label: "Assistant thread request",
      }),
    );
  }

  async deleteThread(storyId: string, thread: AssistantThread): Promise<void> {
    const revision =
      this.revisions.get(`thread:${thread.id}`) ?? thread.revision;
    await request<void>(`${this.base(storyId)}/${thread.id}`, {
      method: "DELETE",
      revision,
      auth: "required",
      label: "Assistant thread request",
    });
    this.revisions.delete(`thread:${thread.id}`);
  }

  async listMessages(
    storyId: string,
    threadId: string,
    cursor?: string,
    limit?: number,
  ): Promise<AssistantMessagePage> {
    const page = await request<{
      messages: ApiAssistantMessage[];
      nextCursor?: string;
    }>(`${this.base(storyId)}/${threadId}/messages${query(cursor, limit)}`, {
      auth: "required",
      label: "Assistant messages request",
    });
    return {
      ...page,
      messages: page.messages.map((message) => this.message(message)),
    };
  }

  async appendMessage(
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
  ): Promise<AssistantMessage> {
    return this.message(
      await request<ApiAssistantMessage>(
        `${this.base(storyId)}/${threadId}/messages`,
        {
          method: "POST",
          body: input,
          auth: "required",
          label: "Assistant messages request",
        },
      ),
    );
  }

  async updateMessage(
    storyId: string,
    threadId: string,
    message: AssistantMessage,
    patch: {
      parts: unknown[];
      status: AssistantMessageStatus;
      metadata?: Record<string, unknown>;
    },
  ): Promise<AssistantMessage> {
    const revision =
      this.revisions.get(`message:${message.id}`) ?? message.revision;
    return this.message(
      await request<ApiAssistantMessage>(
        `${this.base(storyId)}/${threadId}/messages/${message.id}`,
        {
          method: "PATCH",
          body: patch,
          revision,
          auth: "required",
          label: "Assistant messages request",
        },
      ),
    );
  }
}

export const assistantThreadRepo = new AssistantThreadRepo();
