import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader, User } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useGuestbookPolicy } from "@/hooks/queries/useUserQueries";
import { SEOHead } from "@/components/seo/SEOHead";
import GuestbookTabs from "@/components/guestbook/GuestbookTabs";
import WallComposer from "@/components/guestbook/WallComposer";
import WallFilters from "@/components/guestbook/WallFilters";
import WallPostCard from "@/components/guestbook/WallPostCard";
import GuestbookAccessCard from "@/components/guestbook/GuestbookAccessCard";
import NewMembers from "@/components/guestbook/NewMembers";
import FollowingSidebar, {
  FollowingStrip,
} from "@/components/guestbook/FollowingSidebar";
import { normalizePolicy } from "@/lib/guestbookPolicy";
import { groupByDay } from "@/lib/guestbookWall";
import { guestbookRepo, IGuestbookEntry } from "@novelsync/story-data-client";
import { rateLimitMessage } from "@/lib/rateLimitError";
import {
  useWallFeed,
  useAddWallEntryToCache,
  useRemoveWallEntryFromCache,
  WallFilter,
} from "@/hooks/queries/useGuestbookQueries";

/**
 * The personal, strictly reverse-chronological combined feed: your own
 * posts, posts by people you follow (wherever they posted), and notes left
 * on your own page. Replaces the old "visit one wall at a time" model as
 * the signed-in user's home base in the social area.
 */
const WallPage: React.FC = () => {
  const { user, loading: authLoading } = useAuthContext();
  const [filter, setFilter] = useState<WallFilter>("all");
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const { data: guestbookPolicy, isLoading: policyLoading } =
    useGuestbookPolicy(user?.uid);

  const {
    data,
    isLoading,
    isError,
    error: loadError,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useWallFeed(user?.uid, filter);

  const addEntry = useAddWallEntryToCache(user?.uid, filter);
  const removeEntry = useRemoveWallEntryFromCache(user?.uid, filter);

  const entries = data?.pages.flatMap((p) => p.entries) ?? [];
  // A note you just posted only belongs in "all"/"mine" — the "following"
  // filter is scoped to other people's authorship, so it never gains a row
  // from your own post; that cache is left alone rather than corrupted.
  const canShowOwnPostHere = filter !== "following";

  const handlePost = async (content: string) => {
    if (!user) return;
    setIsPosting(true);
    setPostError(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticEntry: IGuestbookEntry = {
      id: tempId,
      ownerId: user.uid,
      ownerUsername: user.username || undefined,
      content,
      createdAt: new Date(),
      authorUsername: user.username || "unknown",
      authorId: user.uid,
      commentCount: 0,
      upvoteCount: 0,
      downvoteCount: 0,
      userVote: null,
    };
    if (canShowOwnPostHere) addEntry(optimisticEntry);

    try {
      const created = await guestbookRepo.createEntry(user.uid, content);
      if (canShowOwnPostHere) {
        removeEntry(tempId);
        addEntry({ ...created, ownerUsername: user.username || undefined });
      }
    } catch (err) {
      console.error("Error posting to wall:", err);
      if (canShowOwnPostHere) removeEntry(tempId);
      setPostError(rateLimitMessage(err, "Failed to post. Please try again."));
      throw err;
    } finally {
      setIsPosting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ns-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-ns-bg flex items-center justify-center px-4">
        <div className="bg-ns-elevated border border-ns-border rounded-ns-xl p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-ns-surface border border-ns-border flex items-center justify-center">
            <User className="w-6 h-6 text-ns-ink-muted" />
          </div>
          <h1 className="font-heading text-xl text-ns-ink mb-2">
            Sign in to see your guestbook
          </h1>
          <Link
            to="/sign-in"
            className="inline-flex items-center justify-center px-4 py-2 rounded-ns bg-ns-accent text-white font-ui text-sm hover:opacity-90 transition-opacity"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const rows = groupByDay(entries);

  return (
    <div className="min-h-screen bg-ns-bg">
      <SEOHead title="Your guestbook" noindex />
      <div className="max-w-[1320px] mx-auto px-4 sm:px-10 py-8 sm:py-9">
        <header className="mb-6">
          <h1 className="font-heading text-3xl sm:text-[44px] text-ns-ink leading-none tracking-[-0.015em]">
            Your guestbook
          </h1>
          <div className="mt-3.5">
            <GuestbookTabs active="wall" />
          </div>
        </header>

        <FollowingStrip following={user.following ?? []} />

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[248px_minmax(0,1fr)_268px] lg:gap-10">
          <div className="hidden lg:sticky lg:top-6 lg:col-start-1 lg:row-start-1 lg:block">
            <FollowingSidebar following={user.following ?? []} />
          </div>

          <div className="order-2 flex min-w-0 flex-col gap-[22px] lg:order-none lg:col-start-2 lg:row-start-1">
            <WallComposer
              currentUser={user}
              policy={normalizePolicy(guestbookPolicy)}
              onSubmit={handlePost}
              isLoading={isPosting}
            />

            {postError && (
              <div className="px-4 py-3 bg-ns-accent-subtle border border-ns-destructive/20 rounded-ns font-ui text-sm text-ns-destructive">
                {postError}
              </div>
            )}

            <WallFilters filter={filter} onChange={setFilter} />

            {isError && (
              <div className="px-4 py-3 bg-ns-accent-subtle border border-ns-destructive/20 rounded-ns font-ui text-sm text-ns-destructive">
                {loadError instanceof Error
                  ? loadError.message
                  : "Failed to load your wall. Please refresh and try again."}
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center items-center py-16">
                <Loader className="animate-spin text-ns-accent" size={28} />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-heading text-title font-light text-ns-ink-muted mb-1">
                  Your wall is quiet
                </p>
                <p className="font-ui text-sm text-ns-ink-muted">
                  {filter === "all"
                    ? "Post something, or follow more writers in People."
                    : filter === "following"
                      ? "Nobody you follow has posted yet."
                      : "Nothing on your own wall yet."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {rows.map((row, i) =>
                  row.isDivider ? (
                    <div
                      key={`divider-${i}`}
                      className="flex items-center gap-3.5 pt-3.5 pb-1"
                    >
                      <span className="font-ui text-[11px] font-bold tracking-[0.14em] uppercase text-ns-ink-muted">
                        {row.label}
                      </span>
                      <span className="flex-1 h-px bg-ns-border" />
                    </div>
                  ) : (
                    <WallPostCard
                      key={row.entry.id}
                      entry={row.entry}
                      currentUser={user}
                      onEntryDeleted={removeEntry}
                    />
                  ),
                )}

                {hasNextPage && (
                  <div className="text-center pt-5 pb-1">
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center gap-2 font-ui text-[13.5px] font-bold text-ns-accent border border-ns-border bg-ns-elevated rounded-full px-6 py-2.5 hover:border-ns-border-strong transition-colors disabled:opacity-50"
                    >
                      {isFetchingNextPage && (
                        <Loader className="animate-spin" size={14} />
                      )}
                      Older posts
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="order-1 flex flex-col gap-5 lg:order-none lg:sticky lg:top-6 lg:col-start-3 lg:row-start-1">
            <GuestbookAccessCard
              userId={user.uid}
              current={guestbookPolicy}
              isLoading={policyLoading}
            />
            <div className="hidden lg:block">
              <NewMembers
                viewerId={user.uid}
                following={user.following ?? []}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WallPage;
