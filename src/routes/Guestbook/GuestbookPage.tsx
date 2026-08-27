import React, { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { UserX } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
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
  FollowingStrip,
} from "@/components/guestbook/FollowingSidebar";
import { normalizePolicy } from "@/lib/guestbookPolicy";

const GuestbookPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuthContext();
  const isSelf = !!user && user.uid === userId;
  const [entryCount, setEntryCount] = useState<number | undefined>(undefined);

  // usePublicProfile no-ops while signed out; the sign-in prompt below covers it.
  // Called unconditionally regardless of isSelf, which only becomes known
  // after auth resolves — a hook can't sit behind that check.
  const { data: profile, isLoading: profileLoading } = usePublicProfile(userId);
  const { data: guestbookPolicy } = useGuestbookPolicy(userId);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ns-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent"></div>
      </div>
    );
  }

  // Your own wall now lives at the combined feed — this page is only for
  // visiting someone else's.
  if (isSelf) {
    return <Navigate to="/guestbook" replace />;
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ns-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent"></div>
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

        <FollowingStrip
          following={user?.following ?? []}
          activeUserId={userId}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)_268px] gap-8 lg:gap-10 items-start">
          <div className="hidden lg:block lg:sticky lg:top-6">
            <FollowingSidebar
              following={user?.following ?? []}
              activeUserId={userId}
            />
          </div>

          <div className="min-w-0">
            <Guestbook
              ownerId={userId}
              currentUser={user}
              guestbookPolicy={normalizePolicy(guestbookPolicy)}
              ownerUsername={username}
              onEntryCountChange={setEntryCount}
            />
          </div>

          <div className="hidden lg:flex lg:sticky lg:top-6 flex-col gap-5">
            <AboutOwner owner={profile} />
            <GuestbookSigners ownerId={userId} viewerId={user?.uid ?? null} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestbookPage;
