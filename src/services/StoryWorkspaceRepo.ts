import { auth } from "@/config/firebase";
import type { Chapter, Story, StoryMetadata } from "@/types/IStory";

const baseURL = import.meta.env.VITE_STORY_DATA_URL || "/story-data";

interface ApiStory {
  id: string;
  ownerId: string;
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
  published: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiChapter {
  id: string;
  storyId: string;
  title: string;
  content: string;
  position: number;
  wordCount: number;
  revision: number;
}

export class StoryDataConflictError extends Error {}

export class StoryWorkspaceRepo {
  private revisions = new Map<string, number>();

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
    revision?: number,
  ): Promise<T> {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be signed in.");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = await user.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (import.meta.env.DEV) headers["X-User-ID"] = user.uid;
    if (revision !== undefined) headers["If-Match"] = String(revision);

    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 409) {
      throw new StoryDataConflictError("This story changed elsewhere. Reload before saving again.");
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Story request failed (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private story(api: ApiStory): Story {
    this.revisions.set(`story:${api.id}`, api.revision);
    return {
      id: api.id,
      userId: api.ownerId,
      title: api.title,
      description: api.description,
      author: api.authorName,
      isPublished: api.published,
      createdAt: new Date(api.createdAt),
      updatedAt: new Date(api.updatedAt),
      chapterCount: 0,
      views: 0,
      likes: 0,
      category: api.category || undefined,
      tags: api.tags,
      targetAudience: api.targetAudience || undefined,
      language: api.language || undefined,
      copyright: api.copyright || undefined,
      coverImageUrl: api.coverImageUrl || undefined,
      thumbnailUrl: api.thumbnailUrl || undefined,
      revision: api.revision,
    };
  }

  private chapter(api: ApiChapter, ownerId: string): Chapter {
    this.revisions.set(`chapter:${api.id}`, api.revision);
    return { id: api.id, title: api.title, content: api.content, order: api.position, wordCount: api.wordCount, userId: ownerId, revision: api.revision };
  }

  async getStory(storyId: string): Promise<Story | null> {
    try { return this.story(await this.request<ApiStory>("GET", `/v1/stories/${storyId}`)); } catch (error) { if (error instanceof Error && error.message.includes("404")) return null; throw error; }
  }
  async getUserStories(): Promise<StoryMetadata[]> {
    const stories = await this.request<ApiStory[]>("GET", "/v1/stories");
    return stories.map((story) => this.story(story));
  }
  async createStory(input: Omit<ApiStory, "id" | "ownerId" | "revision" | "createdAt" | "updatedAt">): Promise<Story> {
    return this.story(await this.request<ApiStory>("POST", "/v1/stories", input));
  }
  async updateStory(story: Story): Promise<Story> {
    const revision = this.revisions.get(`story:${story.id}`) ?? story.revision;
    if (!revision) throw new Error("Story revision is missing. Reload the story.");
    return this.story(await this.request<ApiStory>("PATCH", `/v1/stories/${story.id}`, {
      title: story.title, description: story.description, authorName: story.author,
      category: story.category || "", tags: story.tags || [], targetAudience: story.targetAudience || "", language: story.language || "", copyright: story.copyright || "",
      coverImageUrl: story.coverImageUrl || "", thumbnailUrl: story.thumbnailUrl || "", published: story.isPublished,
    }, revision));
  }
  async updateStoryByID(storyId: string, updates: Partial<Story>): Promise<Story> {
    const story = await this.getStory(storyId);
    if (!story) throw new Error("Story not found");
    return this.updateStory({ ...story, ...updates });
  }
  async deleteStory(story: Story): Promise<void> { const revision=this.revisions.get(`story:${story.id}`) ?? story.revision; if (!revision) throw new Error("Story revision is missing. Reload the story."); await this.request<void>("DELETE", `/v1/stories/${story.id}`, undefined, revision); }
  async deleteStoryByID(storyId: string): Promise<void> { const story=await this.getStory(storyId); if (!story) throw new Error("Story not found"); return this.deleteStory(story); }
  async getChapters(story: Story): Promise<Chapter[]> { const chapters=await this.request<ApiChapter[]>("GET", `/v1/stories/${story.id}/chapters`); return chapters.map((chapter)=>this.chapter(chapter,story.userId)); }
  async createChapter(story: Story, title: string, position: number): Promise<Chapter> { return this.chapter(await this.request<ApiChapter>("POST", `/v1/stories/${story.id}/chapters`, {title,content:"",position}),story.userId); }
  async updateChapter(story: Story, chapter: Chapter, title: string, content: string): Promise<Chapter> { const revision=this.revisions.get(`chapter:${chapter.id}`) ?? chapter.revision; if (!revision) throw new Error("Chapter revision is missing. Reload the story."); return this.chapter(await this.request<ApiChapter>("PATCH", `/v1/stories/${story.id}/chapters/${chapter.id}`,{title,content,position:chapter.order},revision),story.userId); }
  async deleteChapter(story: Story, chapter: Chapter): Promise<void> { const revision=this.revisions.get(`chapter:${chapter.id}`) ?? chapter.revision; if (!revision) throw new Error("Chapter revision is missing. Reload the story."); await this.request<void>("DELETE", `/v1/stories/${story.id}/chapters/${chapter.id}`,undefined,revision); }
}

export const storyWorkspaceRepo = new StoryWorkspaceRepo();
