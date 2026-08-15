import type { Chapter, Story, StoryMetadata } from "@/types/IStory";

const baseURL = import.meta.env.VITE_STORY_DATA_URL || "/story-data";

const STORIES_PAGE_SIZE = 24;

interface ApiPublicStory {
  id: string;
  authorId: string;
  title: string;
  description: string;
  authorName: string;
  category: string;
  targetAudience: string;
  language: string;
  copyright: string;
  coverImageUrl: string;
  thumbnailUrl: string;
  tags: string[];
  chapterCount: number;
  views: number;
  likeCount: number;
  averageRating?: number;
  ratingsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiPublicChapter {
  id: string;
  storyId: string;
  title: string;
  content?: string;
  position: number;
  wordCount: number;
}

interface ApiPublicStoryDetail {
  story: ApiPublicStory;
  chapters: ApiPublicChapter[];
}

interface ApiPublicStoryPage {
  stories: ApiPublicStory[];
  nextCursor?: string;
}

export interface PublicStoryPage {
  stories: StoryMetadata[];
  cursor: string | null;
}

class PublicStoryRepo {
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${baseURL}${path}`, init);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Public story request failed (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private story(api: ApiPublicStory): Story {
    return {
      id: api.id,
      userId: api.authorId,
      title: api.title,
      description: api.description,
      author: api.authorName,
      isPublished: true,
      createdAt: new Date(api.createdAt),
      updatedAt: new Date(api.updatedAt),
      chapterCount: api.chapterCount,
      views: api.views,
      likes: api.likeCount,
      averageRating: api.averageRating,
      ratingsCount: api.ratingsCount,
      category: api.category || undefined,
      tags: api.tags,
      targetAudience: api.targetAudience || undefined,
      language: api.language || undefined,
      copyright: api.copyright || undefined,
      coverImageUrl: api.coverImageUrl || undefined,
      thumbnailUrl: api.thumbnailUrl || undefined,
    };
  }

  private chapter(api: ApiPublicChapter, authorId: string): Chapter {
    return {
      id: api.id,
      title: api.title,
      content: api.content || "",
      order: api.position,
      wordCount: api.wordCount,
      userId: authorId,
    };
  }

  async getPublishedStories(cursor: string | null, category?: string): Promise<PublicStoryPage> {
    const params = new URLSearchParams({ limit: String(STORIES_PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);
    if (category && category !== "all") params.set("category", category);
    const page = await this.request<ApiPublicStoryPage>(`/v1/public/stories?${params}`);
    return { stories: page.stories.map((story) => this.story(story)), cursor: page.nextCursor || null };
  }

  async getStoryDetail(storyId: string): Promise<{ story: Story; chapters: Omit<Chapter, "content">[] } | null> {
    try {
      const result = await this.request<ApiPublicStoryDetail>(`/v1/public/stories/${storyId}`);
      const story = this.story(result.story);
      return {
        story,
        chapters: result.chapters.map((chapter) => {
          const { content: _content, ...metadata } = this.chapter(chapter, story.userId);
          return metadata;
        }),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("(404)")) return null;
      throw error;
    }
  }

  async getChapter(storyId: string, chapterId: string, authorId: string): Promise<Chapter | null> {
    try {
      return this.chapter(await this.request<ApiPublicChapter>(`/v1/public/stories/${storyId}/chapters/${chapterId}`), authorId);
    } catch (error) {
      if (error instanceof Error && error.message.includes("(404)")) return null;
      throw error;
    }
  }

  async recordView(storyId: string): Promise<void> {
    await this.request<void>(`/v1/public/stories/${storyId}/views`, { method: "POST" });
  }
}

export const publicStoryRepo = new PublicStoryRepo();
