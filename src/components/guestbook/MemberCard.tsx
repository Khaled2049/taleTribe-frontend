import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PublicProfile } from "@novelsync/story-data-client";
import { useAuthContext } from "@/contexts/AuthContext";
import { formatRelativeTime } from "@/lib/relativeTime";
import { toast } from "sonner";

interface MemberCardProps {
  member: PublicProfile;
  /** The viewer's own followers array — whether this member follows the viewer is
   * knowable client-side, whether they follow anyone else is not. */
  viewerFollowers: readonly string[];
}

const NEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

const MemberCard: React.FC<MemberCardProps> = ({ member, viewerFollowers }) => {
  const { user, followUser, unfollowUser } = useAuthContext();
  const [followPending, setFollowPending] = useState(false);

  const initial = (member.username || "?").charAt(0).toUpperCase();
  const isFollowing = (user?.following ?? []).includes(member.uid);
  const followsViewer = viewerFollowers.includes(member.uid);
  const isNew =
    Date.now() - new Date(member.createdAt).getTime() < NEW_THRESHOLD_MS;
  const interests = (member.writingInterests || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const toggleFollow = async () => {
    if (!user || followPending) return;
    setFollowPending(true);
    try {
      await (isFollowing ? unfollowUser(member.uid) : followUser(member.uid));
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast.error("That didn't save. Try again.");
    } finally {
      setFollowPending(false);
    }
  };

  return (
    <article className="border border-ns-border rounded-ns-lg bg-ns-elevated px-5 py-[18px] flex gap-[15px] items-start hover:border-ns-border-strong transition-colors">
      <Link to={`/profile/${member.uid}`} className="flex-none">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-ui font-bold text-lg ${
            member.isWriter ? "bg-ns-accent" : "bg-ns-ink-muted"
          }`}
        >
          {initial}
        </div>
      </Link>

      <div className="flex-1 min-w-0 flex flex-col gap-[7px]">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <Link
            to={`/profile/${member.uid}`}
            className="font-ui text-[17px] font-bold text-ns-ink no-underline hover:text-ns-accent transition-colors"
          >
            @{member.username}
          </Link>
          {isNew && (
            <span className="font-ui text-[10.5px] font-bold tracking-[0.1em] uppercase text-ns-accent border border-ns-border rounded-xl px-2 py-0.5 bg-ns-bg">
              New here
            </span>
          )}
          <span className="font-ui text-[12.5px] text-ns-ink-muted">
            Joined {formatRelativeTime(new Date(member.createdAt))}
          </span>
        </div>

        {member.bio && (
          <p className="font-body text-[16.5px] leading-[1.45] text-ns-ink [text-wrap:pretty]">
            {member.bio}
          </p>
        )}

        {interests.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {interests.map((tag) => (
              <span
                key={tag}
                className="font-ui text-[11.5px] font-semibold text-ns-ink-secondary bg-ns-surface border border-ns-border rounded-2xl px-2.5 py-[3px]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="font-ui text-[12.5px] text-ns-ink-muted">
          {member.followerCount}{" "}
          {member.followerCount === 1 ? "follower" : "followers"}
        </div>

        {followsViewer && (
          <div className="font-ui text-[12.5px] text-ns-ink-secondary">
            Follows you
          </div>
        )}
      </div>

      <div className="flex-none w-[132px] flex flex-col gap-2">
        {user && user.uid !== member.uid && (
          <button
            type="button"
            onClick={toggleFollow}
            disabled={followPending}
            className={`text-center font-ui text-[13.5px] font-bold py-[9px] rounded-full transition-colors disabled:opacity-50 ${
              isFollowing
                ? "bg-ns-surface text-ns-ink-secondary border border-ns-border hover:border-ns-border-strong"
                : "bg-ns-accent text-white border border-ns-accent hover:bg-ns-accent-hover"
            }`}
          >
            {isFollowing ? "✓ Following" : "Follow"}
          </button>
        )}
        <Link
          to={`/guestbook/${member.uid}`}
          className="text-center font-ui text-[12.5px] text-ns-ink-muted no-underline hover:text-ns-accent transition-colors"
        >
          View page
        </Link>
      </div>
    </article>
  );
};

export default MemberCard;
