import React from "react";
import { Link } from "react-router-dom";
import { RecentFollower } from "@novelsync/story-data-client";
import { formatRelativeTime } from "@/lib/relativeTime";

interface RecentFollowersProps {
  followers: RecentFollower[];
}

const RecentFollowers: React.FC<RecentFollowersProps> = ({ followers }) => {
  if (followers.length === 0) return null;

  return (
    <div className="border border-ns-border rounded-ns-lg bg-ns-surface p-4">
      <div className="font-ui text-[11px] font-bold tracking-[0.14em] uppercase text-ns-ink-muted mb-2.5">
        Followed you back
      </div>
      <div className="flex flex-col gap-3">
        {followers.map((f) => (
          <Link
            key={f.uid}
            to={`/profile/${f.uid}`}
            className="flex items-center gap-2.5 no-underline"
          >
            <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full bg-ns-ink-muted text-white flex items-center justify-center font-ui font-bold text-xs">
              {(f.username || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-ui text-[13.5px] font-semibold text-ns-ink truncate">
                @{f.username}
              </div>
              <div className="font-ui text-[11.5px] text-ns-ink-muted">
                followed you back · {formatRelativeTime(new Date(f.followedAt))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RecentFollowers;
