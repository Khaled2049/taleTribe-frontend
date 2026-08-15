import React, { useState } from "react";
import { MessageCircle, Trash2, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { IGuestbookEntry } from "@/types/IGuestbookEntry";
import { IUser } from "@/types/IUser";
import GuestbookReplies from "./GuestbookReplies";
import VoteButtons from "./VoteButtons";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { guestbookRepo } from "@/services/GuestbookRepo";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useAuthorUsername } from "@/hooks/queries/useUserQueries";
import { formatRelativeTime } from "@/lib/relativeTime";
import { toast } from "sonner";

interface GuestbookEntryCardProps {
  entry: IGuestbookEntry;
  currentUser: IUser | null;
  onEntryDeleted?: (entryId: string) => void;
}

const GuestbookEntryCard: React.FC<GuestbookEntryCardProps> = ({
  entry,
  currentUser,
  onEntryDeleted,
}) => {
  const [replyCount, setReplyCount] = useState(entry.commentCount || 0);
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(entry.upvoteCount || 0);
  const [downvoteCount, setDownvoteCount] = useState(entry.downvoteCount || 0);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(
    entry.userVote || null,
  );
  const [isVoting, setIsVoting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      await guestbookRepo.voteEntry(entry.ownerId, entry.id, voteType);
    } catch (error) {
      console.error("Error voting on guestbook entry:", error);
      setUpvoteCount(previousUpvotes);
      setDownvoteCount(previousDownvotes);
      setUserVote(previousVote);
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

  const authorUsername = useAuthorUsername(entry.authorId, entry.authorUsername);
  const initials = authorUsername.charAt(0).toUpperCase();
  const isAuthor = currentUser?.uid === entry.authorId;
  // The guestbook owner can clear anything off their own page — that is the
  // moderation mechanism, and it is why entries carry no report flow.
  const isOwner = currentUser?.uid === entry.ownerId;
  const canDelete = isAuthor || isOwner;

  const handleRowClick = (e: React.MouseEvent) => {
    // Ignore clicks on interactive elements or inside the replies so votes,
    // menus, links and text selection keep working.
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
      className="group bg-ns-surface border border-ns-border rounded-ns-lg px-[22px] py-5 mb-[18px] hover:bg-ns-surface-hover transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0 font-ui text-[13px] leading-tight">
          <div className="w-[34px] h-[34px] rounded-full bg-ns-accent flex items-center justify-center text-white font-ui font-semibold text-sm flex-shrink-0">
            {initials}
          </div>
          <Link
            to={`/profile/${entry.authorId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-ns-ink truncate no-underline hover:text-ns-accent hover:underline transition-colors"
          >
            @{authorUsername}
          </Link>
          <span className="text-ns-ink-muted">·</span>
          <span className="text-ns-ink-muted">
            {formatRelativeTime(entry.createdAt, { suffix: true })}
          </span>
        </div>

        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex-shrink-0 -mr-1 p-1.5 rounded-full text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover transition-colors focus:outline-none disabled:opacity-40"
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

      <p className="font-body text-ns-ink whitespace-pre-wrap break-words text-[17px] leading-[1.55] mb-3.5">
        {entry.content}
      </p>

      <div className="flex items-center gap-1 -ml-2">
        <VoteButtons
          upvoteCount={upvoteCount}
          downvoteCount={downvoteCount}
          userVote={userVote}
          onVote={handleVote}
          isLoading={isVoting}
          disabled={!currentUser}
        />
        <button
          type="button"
          onClick={() => setRepliesExpanded((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-ui text-xs transition-colors ${
            repliesExpanded
              ? "text-ns-accent bg-ns-accent-subtle"
              : "text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover"
          }`}
          aria-expanded={repliesExpanded}
        >
          <MessageCircle size={15} />
          <span>{replyCount}</span>
        </button>
      </div>

      {repliesExpanded && (
        <div data-no-rowclick>
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

export default GuestbookEntryCard;
