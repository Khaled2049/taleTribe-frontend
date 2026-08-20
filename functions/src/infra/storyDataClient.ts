/** Minimal Firebase-Functions → story-data client for canonical chapter access. */
const baseURL = () => (process.env.STORY_DATA_URL || "http://localhost:8084").replace(/\/$/, "");

/** Carries the status so callers can tell "not found" from "story-data is down"
 * without matching on message text. */
export class StoryDataRequestError extends Error {
  constructor(readonly status: number) {
    super(`story-data request failed (${status})`);
    this.name = "StoryDataRequestError";
  }
}

async function request<T>(path: string, idToken: string, userId: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseURL()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, "X-User-ID": userId, ...(init?.headers || {}) },
  });
  if (!response.ok) throw new StoryDataRequestError(response.status);
  return response.json() as Promise<T>;
}

export interface StoryDataChapter { id: string; title: string; content: string; revision: number; summary?: string }
export const getStoryDataChapter = (storyId: string, chapterId: string, idToken: string, userId: string) => request<StoryDataChapter>(`/v1/stories/${storyId}/chapters/${chapterId}`, idToken, userId);
export const putStoryDataSummary = (storyId: string, chapterId: string, summary: string, revision: number, idToken: string, userId: string) => request<StoryDataChapter>(`/v1/stories/${storyId}/chapters/${chapterId}/summary`, idToken, userId, { method: "PUT", headers: { "If-Match": String(revision) }, body: JSON.stringify({ summary }) });
