import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { UserX, WifiOff } from "lucide-react";
import { WallPageSkeleton } from "@/components/guestbook/WallSkeleton";
import { useAuthContext } from "@/contexts/AuthContext";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { getCurrentUid, useAuthIdentity } from "@novelsync/platform-auth";
import { guestbookEntriesQuery } from "@/hooks/queries/useGuestbookQueries";
import {
  useGuestbookPolicy,
  usePublicProfile,
} from "@/hooks/queries/useUserQueries";
import { SEOHead } from "@/components/seo/SEOHead";
import Guestbook from "@/components/guestbook/Guestbook";
import GuestbookTabs from "@/components/guestbook/GuestbookTabs";
import AboutOwner from "@/components/guestbook/AboutOwner";
import GuestbookSigners from "@/components/guestbook/GuestbookSigners";
import FollowingSidebar, {
  FollowingDrawer,
} from "@/components/guestbook/FollowingSidebar";
import { normalizePolicy } from "@/lib/guestbookPolicy";

const GuestbookPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: hydratedUser, loading: authLoading } = useAuthContext();
  const identity = useAuthIdentity();
  const identityReady = !identity.loading && identity.uid === getCurrentUid();
  const user =
    identityReady && hydratedUser?.uid === identity.uid ? hydratedUser : null;
  const isSelf = !!identity.uid && identity.uid === userId;
  const { isLgUp } = useBreakpoint();
  const [entryCount, setEntryCount] = useState<number | undefined>(undefined);
  const queryClient = useQueryClient();

  // Profile and first entries start in parallel. An unresolved identity must
  // not cache an anonymous page that immediately needs an authenticated reread.
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileFailed,
    isFetching: profileFetching,
    refetch: retryProfile,
  } = usePublicProfile(userId);
  const { data: guestbookPolicy } = useGuestbookPolicy(userId);
  useEffect(() => {
    if (!userId || isSelf || !identityReady) return;
    void queryClient.prefetchInfiniteQuery(
      guestbookEntriesQuery(userId, identity.uid),
    );
  }, [queryClient, userId, isSelf, identityReady, identity.uid]);

  if (!identityReady || (authLoading && !identity.uid)) {
    return <WallPageSkeleton />;
  }

  // Your own wall now lives at the combined feed — this page is only for
  // visiting someone else's.
  if (isSelf) {
    return <Navigate to="/guestbook" replace />;
  }

  if (profileLoading) {
    return <WallPageSkeleton />;
  }

  // A missing profile resolves to null; only that means "doesn't exist".
  if (profileFailed && !profile) {
    return (
      <div className="min-h-screen bg-ns-bg flex items-center justify-center px-4">
        <div className="text-center" role="alert">
          <WifiOff className="w-10 h-10 mx-auto mb-4 text-ns-ink-muted opacity-40" />
          <h1 className="font-heading text-xl text-ns-ink mb-2">
            Couldn't load this guestbook
          </h1>
          <p className="font-body text-sm text-ns-ink-secondary mb-6">
            Something went wrong on the way. The guestbook may still be there.
          </p>
          <button
            type="button"
            onClick={() => retryProfile()}
            disabled={profileFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface hover:text-ns-ink transition-all duration-150 disabled:opacity-50"
          >
            {profileFetching ? "Retrying…" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  if (!userId || !profile) {
    return (
      <div className="min-h-screen bg-ns-bg flex items-center justify-center px-4">
        <div className="text-center">
          <UserX className="w-10 h-10 mx-auto mb-4 text-ns-ink-muted opacity-40" />
          <h1 className="font-heading text-xl text-ns-ink mb-2">
            This guestbook doesn't exist
          </h1>
          <p className="font-body text-sm text-ns-ink-secondary mb-6">
            The member you're looking for may have changed their account.
          </p>
          <Link
            to="/stories"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface hover:text-ns-ink transition-all duration-150"
          >
            Browse stories
          </Link>
        </div>
      </div>
    );
  }

  // Viewing someone else's wall — isSelf redirected above, so this is
  // always the visited profile's own username.
  const username = profile.username;
  const initial = (username || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-ns-bg">
      <SEOHead title={`@${username}'s guestbook`} noindex />
      <div className="max-w-[1320px] mx-auto px-4 sm:px-10 py-8 sm:py-9">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex-shrink-0 rounded-full bg-ns-teal text-white flex items-center justify-center font-ui font-bold text-lg">
              {initial}
            </div>
            <h1 className="font-heading text-3xl sm:text-[38px] text-ns-ink leading-none tracking-[-0.015em]">
              @{username}'s guestbook
            </h1>
          </div>
          <div className="mt-4">
            <GuestbookTabs active="wall" trailingCount={entryCount} />
          </div>
        </header>

        {/* empty:hidden — FollowingDrawer renders nothing when you follow
            nobody, and a bare row would still contribute its margin. */}
        {!isLgUp && (
          <div className="lg:hidden mb-5 flex items-center gap-3 empty:hidden">
            <FollowingDrawer
              following={user?.following ?? []}
              activeUserId={userId}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)_268px] gap-8 lg:gap-10 items-start">
          {/* The column stays so the grid keeps its three tracks. */}
          <div className="hidden lg:block lg:sticky lg:top-6">
            {isLgUp && (
              <FollowingSidebar
                following={user?.following ?? []}
                activeUserId={userId}
              />
            )}
          </div>

          <div className="min-w-0">
            <Guestbook
              ownerId={userId}
              viewerId={identity.uid}
              currentUser={user}
              guestbookPolicy={normalizePolicy(guestbookPolicy)}
              ownerUsername={username}
              onEntryCountChange={setEntryCount}
            />
          </div>

          <div className="hidden lg:flex lg:sticky lg:top-6 flex-col gap-5">
            <AboutOwner owner={profile} />
            <GuestbookSigners ownerId={userId} viewerId={identity.uid} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestbookPage;
