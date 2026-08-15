import { auth } from "@/config/firebase";
import type { Comment } from "@/types/IComment";

const baseURL = import.meta.env.VITE_STORY_DATA_URL || "/story-data";

export interface StorySocialSummary {
  likeCount: number;
  averageRating?: number;
  ratingsCount: number;
}

export interface StorySocialMe {
  liked: boolean;
  rating?: number;
}

interface ApiComment {
  id: string;
  storyId: string;
  chapterId: string;
  message: string;
  userId: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

class StorySocialRepo {
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be signed in.");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = await user.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (import.meta.env.DEV) headers["X-User-ID"] = user.uid;
    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Story social request failed (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private async publicRequest<T>(path: string): Promise<T> {
    const response = await fetch(`${baseURL}${path}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Public social request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  private comment(comment: ApiComment): Comment {
    return {
      id: comment.id,
      storyId: comment.storyId,
      chapterId: comment.chapterId,
      message: comment.message,
      userId: comment.userId,
      parentId: comment.parentId || null,
      createdAt: new Date(comment.createdAt),
      updatedAt: new Date(comment.updatedAt),
    };
  }

  getMe(storyId: string) {
    return this.request<StorySocialMe>("GET", `/v1/stories/${storyId}/social/me`);
  }

  setLike(storyId: string, liked: boolean) {
    return this.request<StorySocialSummary>(liked ? "PUT" : "DELETE", `/v1/stories/${storyId}/likes/me`);
  }

  createRating(storyId: string, rating: number) {
    return this.request<StorySocialSummary>("POST", `/v1/stories/${storyId}/ratings`, { rating });
  }

  async getComments(storyId: string, chapterId: string): Promise<Comment[]> {
    const comments = await this.publicRequest<ApiComment[]>(`/v1/public/stories/${storyId}/chapters/${chapterId}/comments`);
    return comments.map((comment) => this.comment(comment));
  }

  async createComment(storyId: string, chapterId: string, message: string, parentId?: string): Promise<Comment> {
    return this.comment(await this.request<ApiComment>("POST", `/v1/stories/${storyId}/chapters/${chapterId}/comments`, { message, parentId: parentId || "" }));
  }

  async updateComment(storyId: string, chapterId: string, commentId: string, message: string): Promise<Comment> {
    return this.comment(await this.request<ApiComment>("PATCH", `/v1/stories/${storyId}/chapters/${chapterId}/comments/${commentId}`, { message }));
  }

  deleteComment(storyId: string, chapterId: string, commentId: string) {
    return this.request<void>("DELETE", `/v1/stories/${storyId}/chapters/${chapterId}/comments/${commentId}`);
  }
}

export const storySocialRepo = new StorySocialRepo();
