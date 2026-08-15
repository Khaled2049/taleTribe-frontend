// CommentList.tsx
import React from "react";
import { Comment as CommentType } from "@/types/IComment";
import { Comment } from "./Comment";
import { IUser } from "@/types/IUser";

interface CommentListProps {
  comments: CommentType[];
  currentUser: IUser | null;
  onReply: (parentId: string, message: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onEdit: (commentId: string, newMessage: string) => Promise<void>;
}

export const CommentList: React.FC<CommentListProps> = React.memo(
  ({
    comments,
    currentUser,

    onReply,
    onDelete,
    onEdit,
  }) => {
    const topLevelComments = comments.filter((comment) => !comment.parentId);

    return (
      <div className="space-y-4">
        {topLevelComments.length > 5 ? (
          <div className="space-y-4">Comments disabled</div>
        ) : (
          topLevelComments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              allComments={comments}
              currentUser={currentUser}
              onReply={onReply}
              onDelete={onDelete}
              onEdit={onEdit}
              depth={0}
            />
          ))
        )}
        {topLevelComments.length === 0 && (
          <p className="text-gray-500 text-center">No comments yet</p>
        )}
      </div>
    );
  },
);
