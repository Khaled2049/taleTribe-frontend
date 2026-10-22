import { request } from "@novelsync/story-data-client";

export interface AdminStoryItem {
  id: string;
  ownerId: string;
  title: string;
  authorName: string;
  published: boolean;
  completionStatus: "ongoing" | "completed";
  revision: number;
  createdAt: string;
  updatedAt: string;
  chapterCount: number;
}

export interface AdminStory extends Omit<AdminStoryItem, "chapterCount"> {
  description: string;
  category: string;
  tags: string[];
  paragraphStyle: "spaced" | "indented";
}

export interface AdminChapter {
  id: string;
  storyId: string;
  title: string;
  content: string;
  wordCount: number;
  revision: number;
  publishedAt?: string;
}

export type AdminStoryStatus = "" | "draft" | "ongoing" | "completed";

const base = "/v1/admin/stories";
const options = { auth: "required", devAdmin: true } as const;

export const adminStoryService = {
  list(
    search: string,
    status: AdminStoryStatus,
    cursor: string,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      q: search,
      status,
      cursor,
      limit: "24",
    });
    return request<{ stories: AdminStoryItem[]; nextCursor?: string }>(
      `${base}?${params}`,
      { ...options, signal },
    );
  },
  get(id: string, signal?: AbortSignal) {
    return request<AdminStory>(`${base}/${id}`, { ...options, signal });
  },
  chapters(id: string, signal?: AbortSignal) {
    return request<AdminChapter[]>(`${base}/${id}/chapters`, {
      ...options,
      signal,
    });
  },
  chapter(storyId: string, id: string, signal?: AbortSignal) {
    return request<AdminChapter>(`${base}/${storyId}/chapters/${id}`, {
      ...options,
      signal,
    });
  },
  delete(id: string, revision: number) {
    return request<void>(`${base}/${id}`, {
      ...options,
      method: "DELETE",
      revision,
    });
  },
};
