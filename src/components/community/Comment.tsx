// Comment.tsx
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Edit2, Trash2, Heart } from "lucide-react";
import { Comment as CommentType } from "@/types/IComment";
import { IUser } from "@/types/IUser";

interface CommentProps {
  comment: CommentType;
  allComments: CommentType[];
  currentUser: IUser | null;
  namesById: Map<string, string>;
  onReply: (parentId: string, message: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onEdit: (commentId: string, newMessage: string) => Promise<void>;
  onLike: (commentId: string, liked: boolean) => Promise<void>;
  depth: number;
}

const MAX_DEPTH = 3;

// Indentation has to be a literal class: Tailwind's compiler scans source text,
// so an interpolated `ml-${n}` is never emitted.
const INDENT = ["ml-0", "ml-2", "ml-4", "ml-6"] as const;

export const Comment: React.FC<CommentProps> = React.memo(
  ({
    comment,
    allComments,
    currentUser,
    namesById,
    onReply,
    onDelete,
    onEdit,
    onLike,
    depth,
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedMessage, setEditedMessage] = useState(comment.message);
    const [isReplying, setIsReplying] = useState(false);
    const [replyMessage, setReplyMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const replies = useMemo(
      () => allComments.filter((c) => c.parentId === comment.id),
      [allComments, comment.id],
    );
    const authorUsername =
      namesById.get(comment.userId) || comment.authorUsername || "unknown";

    const handleEdit = async () => {
      if (editedMessage.trim() === "") return;
      setIsLoading(true);
      try {
        await onEdit(comment.id, editedMessage);
        setIsEditing(false);
        setError(null);
      } catch (err) {
        setError("Failed to update comment");
      } finally {
        setIsLoading(false);
      }
    };

    const handleReply = async () => {
      if (replyMessage.trim() === "") return;
      setIsLoading(true);
      try {
        await onReply(comment.id, replyMessage);
        setReplyMessage("");
        setIsReplying(false);
        setError(null);
      } catch (err) {
        setError("Failed to post reply");
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div
        data-cy="comment"
        className={`${INDENT[Math.min(depth, INDENT.length - 1)]} mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700 transition-all`}
      >
        <div className="p-4 rounded-lg border border-gray-300 dark:border-gray-700 shadow-md bg-white dark:bg-gray-900 transition-colors">
          {/* Error Message */}
          {error && (
            <div className="mb-2 text-sm text-red-500 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Comment Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {comment?.userId ? (
                <Link
                  to={`/profile/${comment.userId}`}
                  className="font-medium text-ns-ink no-underline hover:text-ns-accent hover:underline transition-colors"
                >
                  {authorUsername}
                </Link>
              ) : (
                <span className="font-medium text-ns-ink">
                  {authorUsername}
                </span>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Comment Content */}
          {isEditing ? (
            <div className="mt-2">
              <textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                className="w-full p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green transition-all disabled:opacity-50"
                rows={3}
                disabled={isLoading}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-dark-green dark:bg-light-green text-white dark:text-black hover:bg-light-green dark:hover:bg-dark-green disabled:opacity-50 transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-gray-500 dark:bg-gray-600 text-white hover:bg-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
              {comment.message}
            </p>
          )}

          {/* Comment Actions */}
          <div className="flex items-center gap-4 mt-3 text-sm">
            <button
              data-cy="comment-like"
              onClick={() => onLike(comment.id, !comment.likedByMe)}
              className={`flex items-center gap-1 transition-colors disabled:opacity-50 ${
                comment.likedByMe
                  ? "text-ns-accent"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
              disabled={!currentUser}
              aria-pressed={comment.likedByMe}
              aria-label={comment.likedByMe ? "Remove like" : "Like comment"}
            >
              <Heart
                size={16}
                className={comment.likedByMe ? "fill-current" : undefined}
              />
              {comment.likeCount > 0 && comment.likeCount}
            </button>
            {depth < MAX_DEPTH && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                disabled={isLoading}
              >
                <MessageCircle size={16} />
                Reply
              </button>
            )}
            {currentUser?.uid === comment.userId && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  disabled={isLoading}
                >
                  <Edit2 size={16} />
                  Edit
                </button>
                <button
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                  disabled={isLoading}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </>
            )}
          </div>

          {/* Reply Form */}
          {isReplying && (
            <div className="mt-4">
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Write a reply..."
                className="w-full p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green transition-all disabled:opacity-50"
                rows={3}
                disabled={isLoading}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleReply}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-dark-green dark:bg-light-green text-white dark:text-black hover:bg-light-green dark:hover:bg-dark-green disabled:opacity-50 transition-colors"
                  disabled={isLoading}
                >
                  {isLoading ? "Posting..." : "Reply"}
                </button>
                <button
                  onClick={() => setIsReplying(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-gray-500 dark:bg-gray-600 text-white hover:bg-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nested Replies */}
        {replies.length > 0 && (
          <div className="mt-2">
            {replies.map((reply) => (
              <Comment
                key={reply.id}
                comment={reply}
                allComments={allComments}
                currentUser={currentUser}
                namesById={namesById}
                onReply={onReply}
                onDelete={onDelete}
                onEdit={onEdit}
                onLike={onLike}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);
