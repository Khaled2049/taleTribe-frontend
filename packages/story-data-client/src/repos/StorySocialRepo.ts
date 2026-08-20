import { request } from "../request";
import type { Comment } from "../types/IComment";

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
  authorUsername?: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

class StorySocialRepo {
  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method, body, auth: "required", label: "Story social request" });
  }

  // Anonymous readers get the public projection; a signed-in one sends their
  // token so the server can fill in likedByMe rather than defaulting it false.
  private publicRequest<T>(path: string): Promise<T> {
    return request<T>(path, { auth: "optional", label: "Public social request" });
  }

  private comment(comment: ApiComment): Comment {
    return {
      id: comment.id,
      storyId: comment.storyId,
      chapterId: comment.chapterId,
      message: comment.message,
      userId: comment.userId,
      parentId: comment.parentId || null,
      authorUsername: comment.authorUsername ?? "",
      likeCount: comment.likeCount ?? 0,
      likedByMe: comment.likedByMe ?? false,
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

  async setCommentLike(storyId: string, chapterId: string, commentId: string, liked: boolean): Promise<Comment> {
    return this.comment(
      await this.request<ApiComment>(
        liked ? "PUT" : "DELETE",
        `/v1/stories/${storyId}/chapters/${chapterId}/comments/${commentId}/likes`,
      ),
    );
  }
}

export const storySocialRepo = new StorySocialRepo();
