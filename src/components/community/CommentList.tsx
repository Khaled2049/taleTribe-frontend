// CommentList.tsx
import React from "react";
import { Comment as CommentType } from "@/types/IComment";
import { Comment } from "./Comment";
import { IUser } from "@/types/IUser";
import { useProfileNames } from "@/hooks/queries/useUserQueries";

interface CommentListProps {
  comments: CommentType[];
  currentUser: IUser | null;
  onReply: (parentId: string, message: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onEdit: (commentId: string, newMessage: string) => Promise<void>;
  onLike: (commentId: string, liked: boolean) => Promise<void>;
}

export const CommentList: React.FC<CommentListProps> = React.memo(
  ({ comments, currentUser, onReply, onDelete, onEdit, onLike }) => {
    const topLevelComments = comments.filter((comment) => !comment.parentId);
    // Resolved once for the whole thread. Per-row lookups meant one request
    // per participant, fired in a burst as the thread mounted.
    const namesById = useProfileNames(comments.map((c) => c.userId));

    return (
      <div className="space-y-4">
        {topLevelComments.map((comment) => (
          <Comment
            key={comment.id}
            comment={comment}
            allComments={comments}
            currentUser={currentUser}
            namesById={namesById}
            onReply={onReply}
            onDelete={onDelete}
            onEdit={onEdit}
            onLike={onLike}
            depth={0}
          />
        ))}
        {topLevelComments.length === 0 && (
          <p className="text-gray-500 text-center">No comments yet</p>
        )}
      </div>
    );
  },
);
