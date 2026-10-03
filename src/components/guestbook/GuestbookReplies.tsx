import { useGuestbookMutations } from "@/hooks/queries/useGuestbookMutations";
import { useGuestbookReplies } from "@/hooks/queries/useGuestbookReplies";
import React, { useCallback, useMemo, useState } from "react";
import { Send, ChevronUp } from "lucide-react";
import { IGuestbookReply } from "@novelsync/story-data-client";
import { IUser } from "@/types/IUser";
import { rateLimitMessage } from "@/lib/rateLimitError";
import { GuestbookReply } from "./GuestbookReply";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  GuestbookPolicyContext,
  useGuestbookPolicy,
} from "./guestbookPolicyContext";
import {
  indexReplies,
  isWallClosedError,
  replyErrorMessage,
} from "@/lib/guestbookReplies";

interface GuestbookRepliesProps {
  ownerId: string;
  entryId: string;
  entryAuthorId: string;
  currentUser: IUser | null;
  onHide?: () => void;
}

const NO_REPLIES: IGuestbookReply[] = [];

const GuestbookReplies: React.FC<GuestbookRepliesProps> = ({
  ownerId,
  entryId,
  entryAuthorId,
  currentUser,
  onHide,
}) => {
  const viewerId = currentUser?.uid ?? null;
  const mutations = useGuestbookMutations(viewerId);
  const thread = useGuestbookReplies(ownerId, entryId, viewerId);
  const replies = thread.data?.replies ?? NO_REPLIES;
  const hasOlder = !!thread.data?.nextCursor;
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const [newReply, setNewReply] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingReply, setIsDeletingReply] = useState(false);
  const policy = useGuestbookPolicy();
  // The combined feed renders cards from many walls with no provider above
  // them, so the context says "open" for all of them. Once the server refuses
  // a reply here, stop offering the forms for this thread.
  const [refused, setRefused] = useState(false);
  const canPost = policy.canPost && !refused;
  const threadPolicy = useMemo(
    () => ({ ...policy, canPost }),
    [policy, canPost],
  );

  const signedIn = !!currentUser;

  // Stable handlers and index, so typing in the box below does not re-render
  // every memoized reply in the thread.
  const addReply = useCallback(
    async (content: string, parentId: string | null) => {
      if (!signedIn) return;
      try {
        await mutations.createReply(ownerId, entryId, content, parentId);
      } catch (error) {
        if (isWallClosedError(error)) setRefused(true);
        throw error;
      }
    },
    [signedIn, mutations, ownerId, entryId],
  );
  const handleNestedReply = useCallback(
    (parentId: string, content: string) => addReply(content, parentId),
    [addReply],
  );
  const handleEdit = useCallback(
    async (replyId: string, content: string) => {
      await mutations.editReply(ownerId, entryId, replyId, content);
    },
    [mutations, ownerId, entryId],
  );
  const handleVote = useCallback(
    (reply: IGuestbookReply) => mutations.voteReply(ownerId, reply),
    [mutations, ownerId],
  );
  const loadOlder = async () => {
    setIsLoadingOlder(true);
    setOlderError(false);
    try {
      await mutations.loadMoreReplies(ownerId, entryId);
    } catch (error) {
      console.error("Error loading older replies:", error);
      setOlderError(true);
    } finally {
      setIsLoadingOlder(false);
    }
  };
  const requestDelete = useCallback(
    async (replyId: string) => setPendingDeleteId(replyId),
    [],
  );
  const { roots: topLevelReplies, childrenOf } = useMemo(
    () => indexReplies(replies),
    [replies],
  );

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
        replyErrorMessage(
          error,
          rateLimitMessage(error, "Failed to add reply. Please try again."),
        ),
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

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setIsDeletingReply(true);
    try {
      await mutations.deleteReply(ownerId, entryId, pendingDeleteId);
      setPendingDeleteId(null);
    } catch (error) {
      console.error("Error deleting reply:", error);
    } finally {
      setIsDeletingReply(false);
    }
  };

  return (
    <GuestbookPolicyContext.Provider value={threadPolicy}>
      <div className="mt-3 pt-3 border-t border-ns-border">
        {refused && replyError && (
          <p className="mb-3 text-[13px] font-ui text-ns-ink-secondary">
            {replyError}
          </p>
        )}
        {onHide && (
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={onHide}
              className="flex items-center gap-1 font-ui text-[13.5px] text-ns-ink-muted hover:text-ns-ink transition-colors"
            >
              <ChevronUp size={16} />
              Hide replies
            </button>
          </div>
        )}

        {currentUser && canPost && (
          <form onSubmit={handleSubmit} className="mb-4">
            {replyError && (
              <p className="mb-2 text-[13px] font-ui text-ns-destructive">
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
                className="flex-1 resize-none px-3 py-2 rounded-ns bg-ns-elevated border border-ns-border text-ns-ink placeholder:text-ns-ink-muted font-body text-[14.5px] leading-relaxed focus:outline-none focus:border-ns-border-strong transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!newReply.trim() || isLoading}
                className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-ns-accent text-white rounded-ns font-ui text-[13.5px] font-medium hover:bg-ns-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={13} />
                {isLoading ? "…" : "Reply"}
              </button>
            </div>
          </form>
        )}

        {thread.isPending ? (
          <p className="font-ui text-[13px] text-ns-ink-muted">
            Loading replies…
          </p>
        ) : thread.isError && !thread.data ? (
          <p className="font-ui text-[13px] text-ns-ink-muted text-center py-2">
            Couldn't load replies.{" "}
            <button
              type="button"
              onClick={() => thread.refetch()}
              disabled={thread.isFetching}
              className="text-ns-accent hover:text-ns-accent-hover underline disabled:opacity-50"
            >
              Try again
            </button>
          </p>
        ) : topLevelReplies.length > 0 ? (
          <div className="space-y-1">
            {topLevelReplies.map((reply) => (
              <GuestbookReply
                key={reply.id}
                ownerId={ownerId}
                entryAuthorId={entryAuthorId}
                reply={reply}
                childrenOf={childrenOf}
                currentUser={currentUser}
                onReply={handleNestedReply}
                onDelete={requestDelete}
                onEdit={handleEdit}
                onVote={handleVote}
                depth={0}
              />
            ))}
          </div>
        ) : (
          <p className="font-ui text-[13px] text-ns-ink-muted text-center py-2">
            No replies yet.
          </p>
        )}

        {hasOlder && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={isLoadingOlder}
              className="font-ui text-[13px] font-semibold text-ns-accent hover:text-ns-accent-hover transition-colors disabled:opacity-50"
            >
              {isLoadingOlder
                ? "Loading…"
                : olderError
                  ? "Couldn't load older replies. Try again"
                  : "Show older replies"}
            </button>
          </div>
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
    </GuestbookPolicyContext.Provider>
  );
};

export default GuestbookReplies;
