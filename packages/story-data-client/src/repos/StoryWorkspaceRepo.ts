import { isNotFound } from "../errors";
import { request } from "../request";
import type { Chapter, Story, StoryMetadata } from "../types/IStory";

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

/**
 * The list endpoint returns each story with the aggregates the shelf renders.
 * They are derived per request, so only `GET /v1/stories` carries them — a
 * story from get/create/update has none of these fields.
 */
interface ApiStoryListItem extends ApiStory {
    chapterCount: number;
    wordCount: number;
    views: number;
    likeCount: number;
    averageRating?: number;
    ratingsCount: number;
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

export class StoryWorkspaceRepo {
    private revisions = new Map<string, number>();

    private request<T>(
        method: "GET" | "POST" | "PATCH" | "DELETE",
        path: string,
        body?: unknown,
        revision?: number,
    ): Promise<T> {
        return request<T>(path, {
            method,
            body,
            revision,
            auth: "required",
            label: "Story request",
        });
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
        try { return this.story(await this.request<ApiStory>("GET", `/v1/stories/${storyId}`)); } catch (error) { if (isNotFound(error)) return null; throw error; }
    }
    async getUserStories(): Promise<StoryMetadata[]> {
        const stories = await this.request<ApiStoryListItem[]>("GET", "/v1/stories");
        return stories.map((api) => ({
            ...this.story(api),
            chapterCount: api.chapterCount,
            wordCount: api.wordCount,
            views: api.views,
            likes: api.likeCount,
            averageRating: api.averageRating,
            ratingsCount: api.ratingsCount,
        }));
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
    async deleteStory(story: Story): Promise<void> { const revision = this.revisions.get(`story:${story.id}`) ?? story.revision; if (!revision) throw new Error("Story revision is missing. Reload the story."); await this.request<void>("DELETE", `/v1/stories/${story.id}`, undefined, revision); }
    async deleteStoryByID(storyId: string): Promise<void> { const story = await this.getStory(storyId); if (!story) throw new Error("Story not found"); return this.deleteStory(story); }
    async getChapters(story: Story): Promise<Chapter[]> { return this.getChaptersByStoryId(story.id, story.userId); }
    /** For callers holding a StoryMetadata rather than a full Story — the owner id is only used to stamp the mapped chapters. */
    async getChaptersByStoryId(storyId: string, ownerId = ""): Promise<Chapter[]> { const chapters = await this.request<ApiChapter[]>("GET", `/v1/stories/${storyId}/chapters`); return chapters.map((chapter) => this.chapter(chapter, ownerId)); }
    async createChapter(story: Story, title: string, position: number): Promise<Chapter> { return this.chapter(await this.request<ApiChapter>("POST", `/v1/stories/${story.id}/chapters`, { title, content: "", position }), story.userId); }
    async updateChapter(story: Story, chapter: Chapter, title: string, content: string): Promise<Chapter> { const revision = this.revisions.get(`chapter:${chapter.id}`) ?? chapter.revision; if (!revision) throw new Error("Chapter revision is missing. Reload the story."); return this.chapter(await this.request<ApiChapter>("PATCH", `/v1/stories/${story.id}/chapters/${chapter.id}`, { title, content, position: chapter.order }, revision), story.userId); }
    async deleteChapter(story: Story, chapter: Chapter): Promise<void> { const revision = this.revisions.get(`chapter:${chapter.id}`) ?? chapter.revision; if (!revision) throw new Error("Chapter revision is missing. Reload the story."); await this.request<void>("DELETE", `/v1/stories/${story.id}/chapters/${chapter.id}`, undefined, revision); }
}

export const storyWorkspaceRepo = new StoryWorkspaceRepo();
