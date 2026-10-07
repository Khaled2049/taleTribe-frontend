/** Anonymous reads of story-data's public surface. Nothing here is per-user. */
import { storyDataUrl } from "./site";

const REQUEST_TIMEOUT_MS = 4000;

export interface PublicStory {
  id: string;
  authorId: string;
  title: string;
  description: string;
  authorName: string;
  category: string;
  language: string;
  coverImageUrl: string;
  tags: string[];
  chapterCount: number;
  views: number;
  likeCount: number;
  averageRating?: number;
  ratingsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicChapter {
  id: string;
  title: string;
  content?: string;
  position: number;
  wordCount: number;
  updatedAt: string;
}

export interface PublicStoryDetail {
  story: PublicStory;
  author?: { bio?: string; photoUrl?: string };
  chapters: PublicChapter[];
}

export interface PublicProfile {
  userId: string;
  username: string;
  photoUrl?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  writingInterests?: string;
  createdAt: string;
  updatedAt: string;
  followerCount: number;
  isWriter: boolean;
}

export interface SitemapEntry {
  id: string;
  authorId: string;
  title: string;
  updatedAt: string;
}

/** Carries the status so a missing story (404) is told apart from an outage. */
export class StoryDataError extends Error {
  constructor(readonly status: number) {
    super(`story-data request failed (${status})`);
    this.name = "StoryDataError";
  }
}

export const isNotFound = (error: unknown): boolean =>
  error instanceof StoryDataError && error.status === 404;

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${storyDataUrl()}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new StoryDataError(response.status);
  return response.json() as Promise<T>;
}

export const getStory = (storyId: string) =>
  get<PublicStoryDetail>(`/v1/public/stories/${storyId}`);

export const getChapter = (storyId: string, chapterId: string) =>
  get<PublicChapter>(`/v1/public/stories/${storyId}/chapters/${chapterId}`);

export const getProfile = (userId: string) =>
  get<PublicProfile>(`/v1/public/profiles/${encodeURIComponent(userId)}`);

export async function listStories(filter: { category?: string; tag?: string; author?: string }): Promise<PublicStory[]> {
  const params = new URLSearchParams({ limit: "24" });
  for (const [key, value] of Object.entries(filter)) if (value) params.set(key, value);
  return (await get<{ stories: PublicStory[] }>(`/v1/public/stories?${params}`)).stories;
}

export const getSitemapPage = (cursor: string) =>
  get<{ stories: SitemapEntry[]; nextCursor?: string }>(
    `/v1/public/sitemap?limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
