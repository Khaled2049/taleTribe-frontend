import React, { useState } from "react";
import { ChevronUp, Trash2, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { IGuestbookEntry } from "@novelsync/story-data-client";
import { IUser } from "@/types/IUser";
import { guestbookRepo } from "@novelsync/story-data-client";
import GuestbookReplies from "./GuestbookReplies";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { formatRelativeTime } from "@/lib/relativeTime";
import { postContextLine } from "@/lib/guestbookWall";
import { toast } from "sonner";

interface WallPostCardProps {
  entry: IGuestbookEntry;
  currentUser: IUser | null;
  onEntryDeleted?: (entryId: string) => void;
  /**
   * Skips the computed postContextLine in favor of a fixed line. The classic
   * single-owner wall (visiting someone else's guestbook) doesn't have
   * entry.ownerUsername — that field only exists on the combined Wall feed,
   * where an entry's owner varies row to row — so the caller, which already
   * knows whose wall this is, supplies the line directly instead.
   */
  contextLineOverride?: string;
}

/**
 * The redesigned post card: one row type used both on the personal Wall feed
 * and on a visited user's classic single wall. Upvote-only (the design drops
 * downvote as noise on a personal wall — backend still stores it, this just
 * never renders or sends a "down" vote), a context line that says why the
 * post is in *your* feed, and no Edit/Report — neither has backend support
 * (deletion is still the only moderation path).
 */
const WallPostCard: React.FC<WallPostCardProps> = ({
  entry,
  currentUser,
  onEntryDeleted,
  contextLineOverride,
}) => {
  const [replyCount, setReplyCount] = useState(entry.commentCount || 0);
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(entry.upvoteCount || 0);
  const [hasUpvoted, setHasUpvoted] = useState(entry.userVote === "up");
  const [isVoting, setIsVoting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpvote = async () => {
    if (!currentUser || isVoting) return;

    const wasUpvoted = hasUpvoted;
    const previousCount = upvoteCount;
    setHasUpvoted(!wasUpvoted);
    setUpvoteCount(wasUpvoted ? previousCount - 1 : previousCount + 1);
    setIsVoting(true);

    try {
      await guestbookRepo.voteEntry(
        entry.ownerId,
        entry.id,
        wasUpvoted ? null : "up",
      );
    } catch (error) {
      console.error("Error voting on guestbook entry:", error);
      setHasUpvoted(wasUpvoted);
      setUpvoteCount(previousCount);
    } finally {
      setIsVoting(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    try {
      await guestbookRepo.deleteEntry(entry.ownerId, entry.id);
      onEntryDeleted?.(entry.id);
      toast.success("Entry deleted");
    } catch (error) {
      console.error("Error deleting guestbook entry:", error);
      toast.error("Failed to delete entry. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const authorUsername = entry.authorUsername || "unknown";
  const initials = authorUsername.charAt(0).toUpperCase();
  const isSelfAuthor = currentUser?.uid === entry.authorId;
  const isAuthor = isSelfAuthor;
  // The guestbook owner can clear anything off their own page — that is the
  // moderation mechanism, and it is why entries carry no report flow.
  const isOwner = currentUser?.uid === entry.ownerId;
  const canDelete = isAuthor || isOwner;

  const contextLine =
    contextLineOverride ??
    (currentUser
      ? postContextLine({
          viewerId: currentUser.uid,
          ownerId: entry.ownerId,
          authorId: entry.authorId,
          ownerUsername: entry.ownerUsername,
        })
      : undefined);

  const replyLabel = replyCount
    ? repliesExpanded
      ? `Hide ${replyCount} repl${replyCount === 1 ? "y" : "ies"}`
      : `${replyCount} repl${replyCount === 1 ? "y" : "ies"}`
    : repliesExpanded
      ? "Cancel"
      : "Reply";

  const handleRowClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(
        "a, button, textarea, input, [role='menu'], [data-no-rowclick]",
      )
    ) {
      return;
    }
    if (window.getSelection()?.toString()) return;
    setRepliesExpanded(true);
  };

  return (
    <article
      onClick={handleRowClick}
      className="border border-ns-border rounded-ns-lg bg-ns-elevated px-5 py-[18px] cursor-pointer"
    >
      <div className="flex items-center gap-[11px]">
        <div
          className={`w-[38px] h-[38px] flex-shrink-0 rounded-full flex items-center justify-center text-white font-ui font-bold text-[15px] ${
            isSelfAuthor ? "bg-ns-ink" : "bg-ns-accent"
          }`}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-ui text-[14.5px] leading-tight">
            <Link
              to={`/profile/${entry.authorId}`}
              onClick={(e) => e.stopPropagation()}
              className="font-bold text-ns-ink no-underline hover:text-ns-accent hover:underline transition-colors"
            >
              @{authorUsername}
            </Link>
            <span className="text-ns-ink-muted">
              {" "}
              · {formatRelativeTime(entry.createdAt, { suffix: true })}
            </span>
          </div>
          {contextLine && (
            <div className="font-ui text-[12.5px] text-ns-ink-muted mt-px">
              {contextLine}
            </div>
          )}
        </div>

        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex-shrink-0 p-1.5 rounded-full text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover transition-colors focus:outline-none disabled:opacity-40"
              disabled={isDeleting}
              aria-label="Entry options"
            >
              <MoreHorizontal size={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onSelect={() => setShowDeleteConfirm(true)}
                className="text-ns-destructive focus:text-ns-destructive"
              >
                <Trash2 size={14} className="mr-2" />
                {isDeleting ? "Deleting…" : "Delete entry"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <p className="font-body text-[19px] leading-[1.5] text-ns-ink mt-3 whitespace-pre-wrap break-words [text-wrap:pretty]">
        {entry.content}
      </p>

      <div className="flex items-center gap-1.5 mt-3.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleUpvote();
          }}
          disabled={!currentUser || isVoting}
          className={`flex items-center gap-1.5 px-3 py-[7px] rounded-full font-ui text-[13.5px] font-bold transition-colors disabled:opacity-50 ${
            hasUpvoted
              ? "bg-ns-accent-subtle text-ns-accent"
              : "bg-ns-surface text-ns-ink-secondary hover:bg-ns-surface-hover"
          }`}
        >
          <ChevronUp size={15} />
          {upvoteCount}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRepliesExpanded((prev) => !prev);
          }}
          className="px-3 py-[7px] rounded-full font-ui text-[13.5px] font-semibold text-ns-ink-secondary hover:bg-ns-surface-hover transition-colors"
          aria-expanded={repliesExpanded}
        >
          {replyLabel}
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="px-3 py-[7px] rounded-full font-ui text-[13.5px] font-semibold text-ns-ink-secondary opacity-60 cursor-default"
        >
          Save
        </button>
      </div>

      {repliesExpanded && (
        <div data-no-rowclick className="mt-3.5">
          <GuestbookReplies
            ownerId={entry.ownerId}
            entryId={entry.id}
            entryAuthorId={entry.authorId}
            currentUser={currentUser}
            onReplyCountChange={setReplyCount}
            onHide={() => setRepliesExpanded(false)}
          />
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete entry?"
        description="This entry and all its replies will be permanently deleted. This cannot be undone."
        confirmLabel="Delete entry"
        cancelLabel="Keep entry"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </article>
  );
};

export default WallPostCard;
