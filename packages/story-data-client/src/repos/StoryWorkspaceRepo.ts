import { isNotFound } from "../errors";
import { request } from "../request";
import type { Chapter, ChapterSummary, CompletionStatus, ParagraphStyle, ReaderUpdate, Story, StoryMetadata } from "../types/IStory";

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
    paragraphStyle?: string;
    published: boolean;
    revision: number;
    createdAt: string;
    updatedAt: string;
    completionStatus?: string;
    nextChapterOn?: string;
    readerNote?: string;
    readerNoteUpdatedAt?: string;
}

/** Unknown or missing reads as undefined, which an update sends as "keep the stored value". */
export const toParagraphStyle = (value: string | undefined): ParagraphStyle | undefined =>
    value === "spaced" || value === "indented" ? value : undefined;

export const toCompletionStatus = (value: string | undefined): CompletionStatus | undefined =>
    value === "ongoing" || value === "completed" ? value : undefined;

/** The reader-update fields as every story endpoint returns them, owner or public. */
export const readerUpdateFields = (api: { completionStatus?: string; nextChapterOn?: string; readerNote?: string; readerNoteUpdatedAt?: string }) => ({
    completionStatus: toCompletionStatus(api.completionStatus),
    nextChapterOn: api.nextChapterOn || undefined,
    readerNote: api.readerNote || undefined,
    readerNoteUpdatedAt: api.readerNoteUpdatedAt ? new Date(api.readerNoteUpdatedAt) : undefined,
});

/**
 * The list endpoint returns each story with the aggregates the shelf renders.
 * They are derived per request, so only `GET /v1/stories` carries them — a
 * story from get/create/update has none of these fields.
 */
interface ApiStoryListItem extends Omit<ApiStory, "targetAudience" | "language" | "copyright" | "tags" | "revision"> {
    targetAudience?: string;
    language?: string;
    copyright?: string;
    tags?: string[];
    revision?: number;
    chapterCount: number;
    wordCount: number;
    views: number;
    likeCount: number;
    averageRating?: number;
    ratingsCount: number;
}

export interface OwnerStoryPage {
    stories: StoryMetadata[];
    summary: { totalStories: number; publishedCount: number; totalViews: number };
    nextCursor?: string;
}

interface ApiChapter {
    id: string;
    storyId: string;
    title: string;
    content: string;
    position: number;
    wordCount: number;
    revision: number;
    publishedAt?: string;
}

const toPublishedAt = (value: string | undefined) => (value ? new Date(value) : undefined);

export class StoryWorkspaceRepo {
    private request<T>(
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
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

    private story(api: ApiStory | ApiStoryListItem): Story {
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
            paragraphStyle: toParagraphStyle(api.paragraphStyle),
            ...readerUpdateFields(api),
        };
    }

    private chapter(api: ApiChapter, ownerId: string): Chapter {
        return { id: api.id, title: api.title, content: api.content, order: api.position, wordCount: api.wordCount, userId: ownerId, revision: api.revision, publishedAt: toPublishedAt(api.publishedAt) };
    }

    async getStory(storyId: string): Promise<Story | null> {
        try { return this.story(await this.request<ApiStory>("GET", `/v1/stories/${storyId}`)); } catch (error) { if (isNotFound(error)) return null; throw error; }
    }
    async getUserStories(): Promise<StoryMetadata[]> {
        const stories = await this.request<ApiStoryListItem[]>("GET", "/v1/stories");
        return stories.map((api) => this.storyListItem(api));
    }
    async getUserStoriesPage(limit = 24, cursor?: string): Promise<OwnerStoryPage> {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set("cursor", cursor);
        const page = await this.request<ApiStoryListItem[] | { stories: ApiStoryListItem[]; summary: OwnerStoryPage["summary"]; nextCursor?: string }>("GET", `/v1/stories?${params}`);
        // Older story-data versions ignore pagination parameters and return
        // the legacy array. Keep the shelf usable during a staggered deploy.
        if (Array.isArray(page)) {
            return {
                stories: page.map((api) => this.storyListItem(api)),
                summary: {
                    totalStories: page.length,
                    publishedCount: page.filter((api) => api.published).length,
                    totalViews: page.reduce((total, api) => total + api.views, 0),
                },
            };
        }
        return { ...page, stories: page.stories.map((api) => this.storyListItem(api)) };
    }
    private storyListItem(api: ApiStoryListItem): StoryMetadata {
        return {
            ...this.story(api),
            chapterCount: api.chapterCount,
            wordCount: api.wordCount,
            views: api.views,
            likes: api.likeCount,
            averageRating: api.averageRating,
            ratingsCount: api.ratingsCount,
        };
    }
    async createStory(input: Omit<ApiStory, "id" | "ownerId" | "revision" | "createdAt" | "updatedAt">): Promise<Story> {
        return this.story(await this.request<ApiStory>("POST", "/v1/stories", input));
    }
    async updateStory(story: Story): Promise<Story> {
        const revision = story.revision;
        if (!revision) throw new Error("Story revision is missing. Reload the story.");
        return this.story(await this.request<ApiStory>("PATCH", `/v1/stories/${story.id}`, {
            title: story.title, description: story.description, authorName: story.author,
            category: story.category || "", tags: story.tags || [], targetAudience: story.targetAudience || "", language: story.language || "", copyright: story.copyright || "",
            coverImageUrl: story.coverImageUrl || "", thumbnailUrl: story.thumbnailUrl || "", published: story.isPublished,
            // Omitted when unknown: story-data rejects unknown fields, so a build that predates this one would refuse the whole save.
            ...(story.paragraphStyle ? { paragraphStyle: story.paragraphStyle } : {}),
        }, revision));
    }
    /** Takes no revision and bumps none, so it never conflicts with a story edit open elsewhere. */
    async updateReaderUpdate(storyId: string, update: ReaderUpdate): Promise<Story> {
        return this.story(await this.request<ApiStory>("PUT", `/v1/stories/${storyId}/reader-update`, update));
    }
    async updateStoryByID(storyId: string, updates: Partial<Story>): Promise<Story> {
        const story = await this.getStory(storyId);
        if (!story) throw new Error("Story not found");
        return this.updateStory({ ...story, ...updates });
    }
    async deleteStory(story: Story): Promise<void> { const revision = story.revision; if (!revision) throw new Error("Story revision is missing. Reload the story."); await this.request<void>("DELETE", `/v1/stories/${story.id}`, undefined, revision); }
    async deleteStoryByID(storyId: string): Promise<void> { const story = await this.getStory(storyId); if (!story) throw new Error("Story not found"); return this.deleteStory(story); }
    async getChapters(story: Story): Promise<Chapter[]> { return this.getChaptersByStoryId(story.id, story.userId); }
    async getChapterIndex(storyId: string, ownerId = ""): Promise<ChapterSummary[]> {
        const chapters = await this.request<ApiChapter[]>("GET", `/v1/stories/${storyId}/chapters?content=false`);
        return chapters.map((api) => ({ id: api.id, title: api.title, order: api.position, wordCount: api.wordCount, userId: ownerId, revision: api.revision, publishedAt: toPublishedAt(api.publishedAt) }));
    }
    async getChapter(storyId: string, chapterId: string, ownerId = ""): Promise<Chapter | null> {
        try { return this.chapter(await this.request<ApiChapter>("GET", `/v1/stories/${storyId}/chapters/${chapterId}`), ownerId); } catch (error) { if (isNotFound(error)) return null; throw error; }
    }
    /** For callers holding a StoryMetadata rather than a full Story — the owner id is only used to stamp the mapped chapters. */
    async getChaptersByStoryId(storyId: string, ownerId = ""): Promise<Chapter[]> { const chapters = await this.request<ApiChapter[]>("GET", `/v1/stories/${storyId}/chapters`); return chapters.map((chapter) => this.chapter(chapter, ownerId)); }
    async createChapter(story: Story, title: string, position: number): Promise<Chapter> { return this.chapter(await this.request<ApiChapter>("POST", `/v1/stories/${story.id}/chapters`, { title, content: "", position }), story.userId); }
    async updateChapter(story: Story, chapter: Chapter, title: string, content: string): Promise<Chapter> { const revision = chapter.revision; if (!revision) throw new Error("Chapter revision is missing. Reload the story."); return this.chapter(await this.request<ApiChapter>("PATCH", `/v1/stories/${story.id}/chapters/${chapter.id}`, { title, content, position: chapter.order }, revision), story.userId); }
    /** Releases a draft to readers or pulls it back. Sends the revision so text saved elsewhere is not released unseen; the revision itself does not change. */
    async setChapterPublication(story: Pick<Story, "id" | "userId">, chapter: Pick<Chapter, "id" | "revision">, published: boolean): Promise<Chapter> { const revision = chapter.revision; if (!revision) throw new Error("Chapter revision is missing. Reload the story."); return this.chapter(await this.request<ApiChapter>("PUT", `/v1/stories/${story.id}/chapters/${chapter.id}/publication`, { published }, revision), story.userId); }
    async deleteChapter(story: Story, chapter: Pick<Chapter, "id" | "revision">): Promise<void> { const revision = chapter.revision; if (!revision) throw new Error("Chapter revision is missing. Reload the story."); await this.request<void>("DELETE", `/v1/stories/${story.id}/chapters/${chapter.id}`, undefined, revision); }
}

export const storyWorkspaceRepo = new StoryWorkspaceRepo();
