import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMemberDirectory } from "@/hooks/queries/usePeopleQueries";
import FollowButton from "@/components/common/FollowButton";
import { formatRelativeTime } from "@/lib/relativeTime";
import { toNewMembers } from "@/lib/newMembers";

interface NewMembersProps {
  /** The viewer, or null when signed out. */
  viewerId: string | null;
  /** The viewer's own `following` array — people already followed are hidden. */
  following: readonly string[];
}

const MAX_MEMBERS = 4;

/**
 * The newest people on the platform, for the combined wall — which has no
 * single owner, so it cannot show "who else signed this guestbook" the way an
 * individual guestbook does.
 *
 * This replaces a hardcoded "Writers you may know" card. The honest title is
 * "New members": real suggestions would need another user's follow graph, and
 * a client may only ever read its own, so that has to be a server-side feature.
 *
 * Shares useMemberDirectory("newest") with the People directory, so navigating
 * between them costs no extra fetch.
 */
const NewMembers: React.FC<NewMembersProps> = ({ viewerId, following }) => {
  const { data } = useMemberDirectory("newest");

  const members = useMemo(() => {
    // Only the first page: this is a sidebar teaser, and "See all" goes to the
    // directory that pages properly.
    const profiles = data?.pages[0]?.profiles ?? [];
    return toNewMembers(profiles, viewerId, following, MAX_MEMBERS);
  }, [data, viewerId, following]);

  if (members.length === 0) return null;

  return (
    <div className="border border-ns-border rounded-ns-lg bg-ns-surface p-4">
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="font-ui text-[11px] font-bold tracking-[0.14em] uppercase text-ns-ink-muted">
          New members
        </div>
        <Link
          to="/guestbook/people"
          className="font-ui text-[11px] font-semibold text-ns-accent no-underline hover:underline"
        >
          See all
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {members.map((member) => (
          <div key={member.uid} className="flex items-center gap-2.5">
            <Link
              to={`/guestbook/${member.uid}`}
              className="flex flex-1 min-w-0 items-center gap-2.5 no-underline"
            >
              {member.photoURL ? (
                <img
                  src={member.photoURL}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-[30px] h-[30px] flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full bg-ns-ink-muted text-white flex items-center justify-center font-ui font-bold text-xs">
                  {(member.username || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-ui text-[13.5px] font-semibold text-ns-ink truncate">
                  @{member.username}
                </div>
                <div className="font-ui text-[11.5px] text-ns-ink-muted truncate">
                  joined {formatRelativeTime(new Date(member.createdAt))}
                </div>
              </div>
            </Link>
            <FollowButton targetId={member.uid} size="sm" className="shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewMembers;
