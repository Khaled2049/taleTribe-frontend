import React, { useCallback, useEffect, useState } from "react";
import { Send, ChevronUp } from "lucide-react";
import { IGuestbookReply } from "@/types/IGuestbookReply";
import { IUser } from "@/types/IUser";
import { guestbookReplyService } from "@/services/GuestbookReplyService";
import { rateLimitMessage } from "@/services/rateLimitError";
import { GuestbookReply } from "./GuestbookReply";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useGuestbookPolicy } from "./guestbookPolicyContext";

interface GuestbookRepliesProps {
  ownerId: string;
  entryId: string;
  currentUser: IUser | null;
  onReplyCountChange?: (count: number) => void;
  onHide?: () => void;
}

const GuestbookReplies: React.FC<GuestbookRepliesProps> = ({
  ownerId,
  entryId,
  currentUser,
  onReplyCountChange,
  onHide,
}) => {
  const [replies, setReplies] = useState<IGuestbookReply[]>([]);
  const [newReply, setNewReply] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingReplies, setIsLoadingReplies] = useState(true);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingReply, setIsDeletingReply] = useState(false);
  const { canPost } = useGuestbookPolicy();

  const loadReplies = useCallback(async () => {
    try {
      setIsLoadingReplies(true);
      const fetched = await guestbookReplyService.getReplies(ownerId, entryId);
      const hydrated = currentUser
        ? await guestbookReplyService.hydrateUserVotes(
            ownerId,
            entryId,
            fetched,
            currentUser.uid,
          )
        : fetched;

      setReplies(hydrated);
      onReplyCountChange?.(hydrated.length);
    } catch (error) {
      console.error("Error loading replies:", error);
    } finally {
      setIsLoadingReplies(false);
    }
  }, [ownerId, entryId, currentUser, onReplyCountChange]);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  const addReply = async (content: string, parentId: string | null) => {
    if (!currentUser) return;
    await guestbookReplyService.addReply(ownerId, entryId, {
      content,
      authorId: currentUser.uid,
      authorUsername: currentUser.username || "unknown",
      parentId,
    });
    await loadReplies();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newReply.trim() || isLoading) return;

    setIsLoading(true);
    setReplyError(null);
    try {
      await addReply(newReply.trim(), null);
      setNewReply("");
    } catch (error) {
      console.error("Error adding reply:", error);
      setReplyError(
        rateLimitMessage(error, "Failed to add reply. Please try again."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleNestedReply = async (parentId: string, content: string) => {
    await addReply(content, parentId);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setIsDeletingReply(true);
    try {
      await guestbookReplyService.deleteReply(
        ownerId,
        entryId,
        pendingDeleteId,
      );
      await loadReplies();
      setPendingDeleteId(null);
    } catch (error) {
      console.error("Error deleting reply:", error);
    } finally {
      setIsDeletingReply(false);
    }
  };

  const handleEdit = async (replyId: string, content: string) => {
    await guestbookReplyService.updateReply(ownerId, entryId, replyId, content);
    await loadReplies();
  };

  const topLevelReplies = replies.filter((r) => !r.parentId);

  return (
    <div className="mt-3 pt-3 border-t border-ns-border">
      {onHide && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={onHide}
            className="flex items-center gap-1 font-ui text-xs text-ns-ink-muted hover:text-ns-ink transition-colors"
          >
            <ChevronUp size={14} />
            Hide replies
          </button>
        </div>
      )}

      {currentUser && canPost && (
        <form onSubmit={handleSubmit} className="mb-4">
          {replyError && (
            <p className="mb-2 text-xs font-ui text-ns-destructive">
              {replyError}
            </p>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              value={newReply}
              onChange={(e) => {
                setNewReply(e.target.value);
                setReplyError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Write a reply…"
              rows={2}
              disabled={isLoading}
              className="flex-1 resize-none px-3 py-2 rounded-ns bg-ns-elevated border border-ns-border text-ns-ink placeholder:text-ns-ink-muted font-body text-xs leading-relaxed focus:outline-none focus:border-ns-border-strong transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newReply.trim() || isLoading}
              className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-ns-accent text-white rounded-ns font-ui text-xs font-medium hover:bg-ns-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={11} />
              {isLoading ? "…" : "Reply"}
            </button>
          </div>
        </form>
      )}

      {isLoadingReplies ? (
        <p className="font-ui text-xs text-ns-ink-muted">Loading replies…</p>
      ) : topLevelReplies.length > 0 ? (
        <div className="space-y-1">
          {topLevelReplies.map((reply) => (
            <GuestbookReply
              key={reply.id}
              ownerId={ownerId}
              reply={reply}
              allReplies={replies}
              currentUser={currentUser}
              onReply={handleNestedReply}
              onDelete={async (replyId) => setPendingDeleteId(replyId)}
              onEdit={handleEdit}
              depth={0}
            />
          ))}
        </div>
      ) : (
        <p className="font-ui text-xs text-ns-ink-muted text-center py-2">
          No replies yet.
        </p>
      )}

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="Delete reply?"
        description="This reply and all its nested replies will be permanently deleted. This cannot be undone."
        confirmLabel="Delete reply"
        cancelLabel="Keep reply"
        variant="danger"
        isLoading={isDeletingReply}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default GuestbookReplies;
