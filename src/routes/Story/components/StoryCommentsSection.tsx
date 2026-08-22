import React from "react";
import { CommentInput } from "@/components/community/CommentInput";
import { CommentList } from "@/components/community/CommentList";
import { Comment as IComment } from "@novelsync/story-data-client";
import { IUser } from "@/types/IUser";

interface StoryCommentsSectionProps {
  comments: IComment[];
  commentsLoading: boolean;
  currentUser: IUser | null;
  onCreate: (message: string) => Promise<void>;
  onReply: (parentId: string, message: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onEdit: (commentId: string, newMessage: string) => Promise<void>;
  onLike: (commentId: string, liked: boolean) => Promise<void>;
}

export const StoryCommentsSection: React.FC<StoryCommentsSectionProps> = ({
  comments,
  commentsLoading,
  currentUser,
  onCreate,
  onReply,
  onDelete,
  onEdit,
  onLike,
}) => {
  return (
    <section>
      <div className="flex items-center gap-3 mb-8">
        <h3 className="font-heading italic text-2xl text-ns-ink">
          Community Reviews
        </h3>
        {comments.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-ns-accent-subtle font-ui text-[10px] font-semibold text-ns-accent">
            {comments.length}
          </span>
        )}
      </div>

      {currentUser && (
        <div className="mb-10">
          <CommentInput currentUser={currentUser} onSubmit={onCreate} />
        </div>
      )}

      {commentsLoading ? (
        <div className="py-10 text-center font-ui text-xs text-ns-ink-muted animate-pulse">
          Loading community thoughts…
        </div>
      ) : (
        <CommentList
          comments={comments}
          currentUser={currentUser}
          onReply={onReply}
          onDelete={onDelete}
          onEdit={onEdit}
          onLike={onLike}
        />
      )}
    </section>
  );
};
