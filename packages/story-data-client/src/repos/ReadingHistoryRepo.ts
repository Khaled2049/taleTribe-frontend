import { request } from "../request";
import type { IReadingProgress } from "../types/IReadingProgress";

interface ApiProgress {
    storyId: string;
    chapterId?: string;
    scrollPercent: number;
    lastReadAt?: string;
}
interface ApiHistoryItem extends ApiProgress {
    chapterIndex: number;
    storyTitle: string;
    storyAuthor: string;
    coverImageUrl: string;
    thumbnailUrl: string;
    totalChapters: number;
}

class ReadingHistoryRepo {
    private request<T>(method: string, path: string, body?: unknown): Promise<T> {
        return request<T>(path, { method, body, auth: "required", label: "Reading history request" });
    }

    async saveProgress(storyId: string, chapterId: string, scrollPercent = 0): Promise<void> {
        try { await this.request<ApiProgress>("PUT", `/v1/me/reading-progress/${storyId}`, { chapterId, scrollPercent: Math.min(1, Math.max(0, scrollPercent)) }); }
        catch (error) { console.warn("Unable to save reading progress:", error); }
    }
    async getProgress(storyId: string): Promise<{ chapterId: string | null; scrollPercent: number }> {
        try {
            const progress = await this.request<ApiProgress>("GET", `/v1/me/reading-progress/${storyId}`);
            return { chapterId: progress.chapterId || null, scrollPercent: progress.scrollPercent || 0 };
        } catch (error) {
            console.warn("Unable to load reading progress:", error);
            return { chapterId: null, scrollPercent: 0 };
        }
    }
    async getRecentlyRead(limit = 5): Promise<IReadingProgress[]> {
        try {
            const items = await this.request<ApiHistoryItem[]>("GET", `/v1/me/reading-history?limit=${limit}`);
            return items.map((item) => ({ storyId: item.storyId, chapterId: item.chapterId, chapterIndex: item.chapterIndex, scrollPercent: item.scrollPercent, lastReadAt: item.lastReadAt ? new Date(item.lastReadAt) : new Date(), storyTitle: item.storyTitle, storyAuthor: item.storyAuthor, coverImageUrl: item.coverImageUrl, thumbnailUrl: item.thumbnailUrl, totalChapters: item.totalChapters }));
        } catch (error) {
            console.warn("Unable to load reading history:", error);
            return [];
        }
    }
    async clearAllProgress(): Promise<void> { await this.request<void>("DELETE", "/v1/me/reading-history"); }
}

export const readingHistoryRepo = new ReadingHistoryRepo();
