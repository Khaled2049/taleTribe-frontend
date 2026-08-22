import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { IGuestbookReply } from "@novelsync/story-data-client";
import { IUser } from "@/types/IUser";
import VoteButtons from "./VoteButtons";
import { guestbookRepo } from "@novelsync/story-data-client";
import { rateLimitMessage } from "@/lib/rateLimitError";
import { useGuestbookPolicy } from "./guestbookPolicyContext";
import { formatRelativeTime } from "@/lib/relativeTime";

interface GuestbookReplyProps {
  ownerId: string;
  entryAuthorId: string;
  reply: IGuestbookReply;
  allReplies: IGuestbookReply[];
  currentUser: IUser | null;
  onReply: (parentId: string, content: string) => Promise<void>;
  onDelete: (replyId: string) => Promise<void>;
  onEdit: (replyId: string, content: string) => Promise<void>;
  depth: number;
}

const MAX_DEPTH = 3;

export const GuestbookReply: React.FC<GuestbookReplyProps> = React.memo(
  ({
    ownerId,
    entryAuthorId,
    reply,
    allReplies,
    currentUser,
    onReply,
    onDelete,
    onEdit,
    depth,
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(reply.content);
    const [isReplying, setIsReplying] = useState(false);
    const { canPost } = useGuestbookPolicy();
    const [replyContent, setReplyContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [upvoteCount, setUpvoteCount] = useState(reply.upvoteCount || 0);
    const [downvoteCount, setDownvoteCount] = useState(
      reply.downvoteCount || 0,
    );
    const [userVote, setUserVote] = useState<"up" | "down" | null>(
      reply.userVote || null,
    );
    const [isVoting, setIsVoting] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const children = useMemo(
      () => allReplies.filter((r) => r.parentId === reply.id),
      [allReplies, reply.id],
    );

    // Live-resolve the author's current username (falls back to the stored copy
    // while the profile loads) so username changes show up here too.
    const authorUsername = reply.authorUsername || "unknown";

    const handleEdit = async () => {
      if (editedContent.trim() === "") return;
      setIsLoading(true);
      try {
        await onEdit(reply.id, editedContent.trim());
        setIsEditing(false);
        setError(null);
      } catch {
        setError("Failed to update reply");
      } finally {
        setIsLoading(false);
      }
    };

    const handleReply = async () => {
      if (replyContent.trim() === "") return;
      setIsLoading(true);
      try {
        await onReply(reply.id, replyContent.trim());
        setReplyContent("");
        setIsReplying(false);
        setError(null);
      } catch (err) {
        setError(rateLimitMessage(err, "Failed to post reply"));
      } finally {
        setIsLoading(false);
      }
    };

    const handleVote = async (voteType: "up" | "down" | null) => {
      if (!currentUser || isVoting) return;

      const previousVote = userVote;
      const previousUpvotes = upvoteCount;
      const previousDownvotes = downvoteCount;

      let newUpvotes = previousUpvotes;
      let newDownvotes = previousDownvotes;

      if (previousVote === "up") newUpvotes -= 1;
      else if (previousVote === "down") newDownvotes -= 1;
      if (voteType === "up") newUpvotes += 1;
      else if (voteType === "down") newDownvotes += 1;

      setUpvoteCount(newUpvotes);
      setDownvoteCount(newDownvotes);
      setUserVote(voteType);
      setIsVoting(true);

      try {
        await guestbookRepo.voteReply(
          ownerId,
          reply.entryId,
          reply.id,
          voteType,
        );
      } catch (error) {
        console.error("Error voting on reply:", error);
        setUpvoteCount(previousUpvotes);
        setDownvoteCount(previousDownvotes);
        setUserVote(previousVote);
      } finally {
        setIsVoting(false);
      }
    };

    const hasChildren = children.length > 0;

    return (
      <div
        className={
          depth > 0 ? "mt-1.5 pl-3 border-l border-ns-border" : "mt-1.5"
        }
      >
        <div className="flex items-start gap-1.5">
          {hasChildren ? (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="mt-1 text-ns-ink-muted hover:text-ns-ink transition-colors flex-shrink-0"
              aria-label={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? (
                <ChevronRight size={11} />
              ) : (
                <ChevronDown size={11} />
              )}
            </button>
          ) : (
            <div className="w-[11px]" />
          )}

          <div className="flex-1 min-w-0">
            <div className="py-1">
              {error && (
                <p className="mb-1 text-[10px] font-ui text-ns-destructive">
                  {error}
                </p>
              )}

              <div className="flex items-center gap-2 mb-1">
                <Link
                  to={`/profile/${reply.authorId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-ui font-semibold text-ns-ink text-xs no-underline hover:text-ns-accent hover:underline transition-colors"
                >
                  @{authorUsername}
                </Link>
                <span className="font-ui text-[10px] text-ns-ink-muted">
                  {formatRelativeTime(reply.createdAt)}
                </span>
              </div>

              {!isCollapsed && (
                <>
                  {isEditing ? (
                    <div className="mt-1 space-y-1.5">
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        rows={2}
                        disabled={isLoading}
                        className="
                          w-full px-2 py-1.5 rounded-ns
                          bg-ns-elevated border border-ns-border
                          text-ns-ink font-body text-xs leading-relaxed
                          focus:outline-none focus:border-ns-accent/50
                          transition-colors disabled:opacity-50 resize-none
                        "
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleEdit}
                          disabled={isLoading}
                          className="px-2.5 py-0.5 text-[10px] font-ui font-medium rounded-full bg-ns-accent text-white hover:bg-ns-accent-hover disabled:opacity-40 transition-colors"
                        >
                          {isLoading ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          disabled={isLoading}
                          className="px-2.5 py-0.5 text-[10px] font-ui font-medium rounded-full bg-ns-surface-hover text-ns-ink-secondary hover:text-ns-ink disabled:opacity-40 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="font-body text-xs text-ns-ink leading-relaxed whitespace-pre-wrap break-words">
                      {reply.content}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2">
                    <VoteButtons
                      upvoteCount={upvoteCount}
                      downvoteCount={downvoteCount}
                      userVote={userVote}
                      onVote={handleVote}
                      isLoading={isVoting}
                      disabled={!currentUser}
                      size="sm"
                    />
                    {depth < MAX_DEPTH && currentUser && canPost && (
                      <button
                        onClick={() => setIsReplying(!isReplying)}
                        disabled={isLoading}
                        className="flex items-center gap-1 font-ui text-[10px] text-ns-ink-muted hover:text-ns-accent transition-colors"
                      >
                        <MessageCircle size={10} />
                        Reply
                      </button>
                    )}
                    {(currentUser?.uid === reply.authorId ||
                      currentUser?.uid === ownerId ||
                      currentUser?.uid === entryAuthorId) && (
                      <>
                        {currentUser?.uid === reply.authorId && (
                          <button
                            onClick={() => setIsEditing(true)}
                            disabled={isLoading}
                            className="flex items-center gap-1 font-ui text-[10px] text-ns-ink-muted hover:text-ns-ink transition-colors"
                          >
                            <Edit2 size={10} />
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(reply.id)}
                          disabled={isLoading}
                          className="flex items-center gap-1 font-ui text-[10px] text-ns-ink-muted hover:text-ns-destructive transition-colors"
                        >
                          <Trash2 size={10} />
                          Delete
                        </button>
                      </>
                    )}
                  </div>

                  {isReplying && (
                    <div className="mt-2 space-y-1.5">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleReply();
                          }
                        }}
                        placeholder="Write a reply…"
                        rows={2}
                        disabled={isLoading}
                        className="
                          w-full px-2 py-1.5 rounded-ns
                          bg-ns-elevated border border-ns-border
                          text-ns-ink placeholder:text-ns-ink-muted
                          font-body text-xs leading-relaxed
                          focus:outline-none focus:border-ns-accent/50
                          transition-colors disabled:opacity-50 resize-none
                        "
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleReply}
                          disabled={isLoading}
                          className="px-2.5 py-0.5 text-[10px] font-ui font-medium rounded-full bg-ns-accent text-white hover:bg-ns-accent-hover disabled:opacity-40 transition-colors"
                        >
                          {isLoading ? "Posting…" : "Reply"}
                        </button>
                        <button
                          onClick={() => setIsReplying(false)}
                          disabled={isLoading}
                          className="px-2.5 py-0.5 text-[10px] font-ui font-medium rounded-full bg-ns-surface-hover text-ns-ink-secondary hover:text-ns-ink disabled:opacity-40 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {isCollapsed && (
                <div className="flex items-center gap-1.5 font-ui text-xs text-ns-ink-muted">
                  <Link
                    to={`/profile/${reply.authorId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-ns-ink font-medium no-underline hover:text-ns-accent hover:underline transition-colors"
                  >
                    @{authorUsername}
                  </Link>
                  <span className="text-[10px]">
                    {formatRelativeTime(reply.createdAt)}
                  </span>
                  {hasChildren && (
                    <span className="text-[10px]">
                      · {children.length}{" "}
                      {children.length === 1 ? "reply" : "replies"}
                    </span>
                  )}
                </div>
              )}
            </div>

            {hasChildren && !isCollapsed && (
              <div className="mt-1">
                {children.map((child) => (
                  <GuestbookReply
                    key={child.id}
                    ownerId={ownerId}
                    entryAuthorId={entryAuthorId}
                    reply={child}
                    allReplies={allReplies}
                    currentUser={currentUser}
                    onReply={onReply}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

GuestbookReply.displayName = "GuestbookReply";
