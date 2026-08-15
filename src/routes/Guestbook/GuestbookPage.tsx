import React from "react";
import { Link, useParams } from "react-router-dom";
import { User, UserX } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { usePublicProfile } from "@/hooks/queries/useUserQueries";
import { SEOHead } from "@/components/seo/SEOHead";
import Guestbook from "@/components/guestbook/Guestbook";
import GuestbookTabs from "@/components/guestbook/GuestbookTabs";
import FollowingSidebar, {
  FollowingStrip,
} from "@/components/guestbook/FollowingSidebar";
import { normalizePolicy } from "@/lib/guestbookPolicy";

const GuestbookPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuthContext();
  const isSelf = !!user && user.uid === userId;

  // usePublicProfile no-ops while signed out; the sign-in prompt below covers it.
  const { data: profile, isLoading: profileLoading } = usePublicProfile(userId);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ns-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent"></div>
      </div>
    );
  }

  // Entries are world-readable, but the owner's @username comes from
  // publicProfiles, which requires auth — so the page gates the same way
  // /profile/:userId does rather than rendering a nameless guestbook.
  if (!user) {
    return (
      <div className="min-h-screen bg-ns-bg flex items-center justify-center px-4">
        <div className="bg-ns-elevated border border-ns-border rounded-ns-xl p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-ns-surface border border-ns-border flex items-center justify-center">
            <User className="w-6 h-6 text-ns-ink-muted" />
          </div>
          <h1 className="font-heading text-xl text-ns-ink mb-2">
            Sign in to view guestbooks
          </h1>
          <p className="font-body text-sm text-ns-ink-secondary mb-6">
            Guestbooks are only visible to signed-in members.
          </p>
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

  // Prefer the live auth value for the owner so a username edit shows instantly.
  const username = (isSelf && user?.username) || profile.username;

  return (
    <div className="min-h-screen bg-ns-bg">
      <SEOHead title={`@${username}'s guestbook`} noindex />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex gap-8 items-start">
          <FollowingSidebar
            following={user.following ?? []}
            activeUserId={userId}
          />

          {/* max-w-3xl keeps the wall the same reading width it has without the
              sidebar, rather than stretching to fill the wider container. */}
          <div className="flex-1 min-w-0 max-w-3xl">
            <header className="pb-8 mb-8 border-b border-ns-border">
              <h1 className="font-heading text-3xl sm:text-4xl text-ns-ink leading-none mb-6">
                {isSelf ? "Your guestbook" : `@${username}'s guestbook`}
              </h1>

              <GuestbookTabs active="wall" wallUserId={userId} />

              <p className="font-body text-[15px] text-ns-ink-secondary leading-relaxed">
                {isSelf
                  ? "Notes other members have left for you. You can remove anything on your own page."
                  : `Leave a note for @${username}.`}
              </p>
            </header>

            <FollowingStrip
              following={user.following ?? []}
              activeUserId={userId}
            />

            <Guestbook
              ownerId={userId}
              currentUser={user}
              guestbookPolicy={normalizePolicy(profile.guestbookPolicy)}
              ownerUsername={username}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestbookPage;
