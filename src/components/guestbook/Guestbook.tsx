import React, { useEffect, useState } from "react";
import { Loader } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { IGuestbookEntry } from "@/types/IGuestbookEntry";
import { IUser } from "@/types/IUser";
import { guestbookRepo } from "@/services/GuestbookRepo";
import { rateLimitMessage } from "@/services/rateLimitError";
import GuestbookEntryCard from "./GuestbookEntryCard";
import SignGuestbookForm from "./SignGuestbookForm";
import { GuestbookPolicyContext } from "./guestbookPolicyContext";
import {
  canPostOnWall,
  normalizePolicy,
  wallClosedReason,
} from "@/lib/guestbookPolicy";
import {
  useGuestbookEntries,
  useRemoveEntryFromCache,
  useAddEntryToCache,
} from "@/hooks/queries/useGuestbookQueries";

interface GuestbookProps {
  ownerId: string;
  currentUser: IUser | null;
  /** From the owner's public profile; absent reads as "everyone". */
  guestbookPolicy?: unknown;
  ownerUsername: string;
}

const Guestbook: React.FC<GuestbookProps> = ({
  ownerId,
  currentUser,
  guestbookPolicy,
  ownerUsername,
}) => {
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewerId = currentUser?.uid ?? null;

  // Both sides of the relationship come off the viewer's own user document —
  // the owner's is unreadable. This only decides whether to render the form;
  // firestore.rules decides whether the write lands.
  const policy = normalizePolicy(guestbookPolicy);
  const canPost = canPostOnWall({
    policy,
    ownerId,
    viewerId,
    viewerFollowing: currentUser?.following ?? [],
    viewerFollowers: currentUser?.followers ?? [],
  });
  const closedReason = canPost ? "" : wallClosedReason(policy, ownerUsername);

  const {
    data,
    isLoading,
    isError,
    error: loadError,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGuestbookEntries(ownerId, viewerId);

  const removeEntry = useRemoveEntryFromCache(ownerId, viewerId);
  const addEntry = useAddEntryToCache(ownerId, viewerId);

  const entries = data?.pages.flatMap((p) => p.entries) ?? [];

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px",
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSign = async (content: string) => {
    if (!currentUser) return;

    setIsSigning(true);
    setError(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticEntry: IGuestbookEntry = {
      id: tempId,
      ownerId,
      content,
      createdAt: new Date(),
      authorUsername: currentUser.username || "unknown",
      authorId: currentUser.uid,
      commentCount: 0,
      upvoteCount: 0,
      downvoteCount: 0,
      userVote: null,
    };

    addEntry(optimisticEntry);

    try {
      const created = await guestbookRepo.createEntry(ownerId, content);
      removeEntry(tempId);
      addEntry(created);
    } catch (err) {
      console.error("Error signing guestbook:", err);
      removeEntry(tempId);
      setError(
        rateLimitMessage(err, "Failed to sign the guestbook. Please try again."),
      );
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <GuestbookPolicyContext.Provider value={{ canPost, policy, closedReason }}>
      <section>
        {currentUser && canPost && (
          <SignGuestbookForm
            onSubmit={handleSign}
            isLoading={isSigning}
            isOwnGuestbook={currentUser.uid === ownerId}
          />
        )}

        {currentUser && !canPost && (
          <p className="mb-6 px-4 py-3 rounded-ns border border-ns-border bg-ns-surface font-ui text-sm text-ns-ink-secondary">
            {closedReason}
          </p>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-ns-accent-subtle border border-ns-accent/20 rounded-ns font-ui text-sm text-ns-destructive">
            {error}
          </div>
        )}
        {isError && (
          <div className="mb-4 px-4 py-3 bg-ns-accent-subtle border border-ns-destructive/20 rounded-ns font-ui text-sm text-ns-destructive">
            {loadError instanceof Error
              ? loadError.message
              : "Failed to load the guestbook. Please refresh and try again."}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader className="animate-spin text-ns-accent" size={28} />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-heading text-title font-light text-ns-ink-muted mb-1">
              Guestbook is empty
            </p>
            <p className="font-ui text-sm text-ns-ink-muted">
              {!currentUser
                ? "Sign in to leave the first entry."
                : canPost
                  ? "Be the first to sign it."
                  : closedReason}
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry) => (
              <GuestbookEntryCard
                key={entry.id}
                entry={entry}
                currentUser={currentUser}
                onEntryDeleted={removeEntry}
              />
            ))}

            <div
              ref={loadMoreRef}
              className="h-10 flex items-center justify-center"
            >
              {isFetchingNextPage && (
                <Loader className="animate-spin text-ns-accent" size={20} />
              )}
            </div>

            {!hasNextPage && (
              <div className="text-center py-8">
                <p className="font-ui text-xs text-ns-ink-muted tracking-wide">
                  · · ·
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </GuestbookPolicyContext.Provider>
  );
};

export default Guestbook;
