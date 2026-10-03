import { useGuestbookMutations } from "@/hooks/queries/useGuestbookMutations";
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader, User } from "lucide-react";
import { FeedError } from "@/components/guestbook/FeedStatus";
import {
  WallFeedSkeleton,
  WallPageSkeleton,
} from "@/components/guestbook/WallSkeleton";
import { useAuthContext } from "@/contexts/AuthContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { getCurrentUid, useAuthIdentity } from "@novelsync/platform-auth";
import { useGuestbookPolicy } from "@/hooks/queries/useUserQueries";
import { SEOHead } from "@/components/seo/SEOHead";
import GuestbookTabs from "@/components/guestbook/GuestbookTabs";
import WallComposer from "@/components/guestbook/WallComposer";
import WallFilters from "@/components/guestbook/WallFilters";
import WallPostCard from "@/components/guestbook/WallPostCard";
import GuestbookAccessCard from "@/components/guestbook/GuestbookAccessCard";
import GuestbookAccessMenu from "@/components/guestbook/GuestbookAccessMenu";
import NewMembers from "@/components/guestbook/NewMembers";
import FollowingSidebar, {
  FollowingDrawer,
} from "@/components/guestbook/FollowingSidebar";
import { normalizePolicy } from "@/lib/guestbookPolicy";
import { feedView, groupByDay } from "@/lib/guestbookWall";
import { IGuestbookEntry } from "@novelsync/story-data-client";
import { rateLimitMessage } from "@/lib/rateLimitError";
import { useWallFeed, WallFilter } from "@/hooks/queries/useGuestbookQueries";

/**
 * The personal, strictly reverse-chronological combined feed: your own
 * posts, posts by people you follow (wherever they posted), and notes left
 * on your own page. Replaces the old "visit one wall at a time" model as
 * the signed-in user's home base in the social area.
 */
const WallPage: React.FC = () => {
  const { user: hydratedUser, loading: authLoading } = useAuthContext();
  const identity = useAuthIdentity();
  const identityReady = !identity.loading && identity.uid === getCurrentUid();
  // Authentication identifies the viewer before the app profile/follow graph
  // is ready. A previous account's hydrated user must never accompany this uid.
  const user =
    identityReady && hydratedUser?.uid === identity.uid ? hydratedUser : null;
  // Both sidebars fetch on mount, so a CSS `hidden` alone would still spend
  // their requests on a phone. Mount only what this breakpoint shows.
  const { isLgUp } = useBreakpoint();
  const [filter, setFilter] = useState<WallFilter>("all");
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const { data: guestbookPolicy, isLoading: policyLoading } =
    useGuestbookPolicy(user?.uid);

  const {
    data,
    isError,
    error: loadError,
    isFetching,
    isRefetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useWallFeed(identityReady ? identity.uid : null, filter);

  const mutations = useGuestbookMutations(user?.uid ?? null);

  const entries = useMemo(
    () => data?.pages.flatMap((p) => p.entries) ?? [],
    [data],
  );
  // "Today" and "Yesterday" go stale at midnight, so the day is a dependency.
  const view = feedView({ hasData: !!data, isError, count: entries.length });
  const today = new Date().toDateString();
  const rows = useMemo(
    () => groupByDay(entries, new Date(today)),
    [entries, today],
  );
  const handlePost = async (content: string) => {
    if (!user) return;
    setIsPosting(true);
    setPostError(null);

    const tempId = `temp-${crypto.randomUUID()}`;
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
    try {
      await mutations.createEntry(optimisticEntry);
    } catch (err) {
      console.error("Error posting to wall:", err);
      setPostError(rateLimitMessage(err, "Failed to post. Please try again."));
      throw err;
    } finally {
      setIsPosting(false);
    }
  };

  if (!identityReady || (authLoading && !identity.uid)) {
    return <WallPageSkeleton title="Your guestbook" />;
  }

  if (!identity.uid) {
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

        {/* Mobile toolbar: the people list on the left as a drawer trigger, the
            one setting on the right as a menu. Together they stand in for both
            desktop sidebars, which is what lets the feed start at the top. */}
        {user && !isLgUp && (
          <div className="lg:hidden mb-5 flex items-center gap-3">
            <FollowingDrawer following={user.following ?? []} />
            <GuestbookAccessMenu
              userId={user.uid}
              current={guestbookPolicy}
              isLoading={policyLoading}
              className="ml-auto"
            />
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[248px_minmax(0,1fr)_268px] lg:gap-10">
          {user && isLgUp && (
            <div className="hidden lg:sticky lg:top-6 lg:col-start-1 lg:row-start-1 lg:block">
              <FollowingSidebar following={user.following ?? []} />
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-[22px] lg:col-start-2 lg:row-start-1">
            {user ? (
              <WallComposer
                currentUser={user}
                policy={normalizePolicy(guestbookPolicy)}
                onSubmit={handlePost}
                isLoading={isPosting}
              />
            ) : authLoading ? (
              <div
                className="h-28 animate-pulse rounded-ns-lg border border-ns-border bg-ns-surface"
                aria-label="Loading composer"
              />
            ) : null}

            {postError && (
              <div className="px-4 py-3 bg-ns-accent-subtle border border-ns-destructive/20 rounded-ns font-ui text-sm text-ns-destructive">
                {postError}
              </div>
            )}

            <WallFilters
              filter={filter}
              onChange={setFilter}
              onRefresh={() => refetch()}
              isRefreshing={isRefetching && !isFetchingNextPage}
            />

            {isError && (
              <FeedError
                message={
                  loadError instanceof Error
                    ? loadError.message
                    : "Failed to load your wall."
                }
                onRetry={() => refetch()}
                isRetrying={isFetching}
              />
            )}

            {view === "loading" ? (
              <WallFeedSkeleton />
            ) : view === "error" ? null : view === "empty" ? (
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

          {/* Desktop only — on mobile this column's one interactive element is
              the toolbar menu above, so the card would just repeat it. */}
          {user && isLgUp && (
            <div className="hidden lg:sticky lg:top-6 lg:col-start-3 lg:row-start-1 lg:flex lg:flex-col lg:gap-5">
              <GuestbookAccessCard
                userId={user.uid}
                current={guestbookPolicy}
                isLoading={policyLoading}
              />
              <NewMembers
                viewerId={user.uid}
                following={user.following ?? []}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WallPage;
