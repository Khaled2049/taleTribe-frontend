import React, { useState } from "react";
import { PublicProfile } from "@novelsync/story-data-client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AboutOwnerProps {
  owner: PublicProfile;
}

/**
 * The right-rail "About {handle}" card on a visited wall.
 */
const AboutOwner: React.FC<AboutOwnerProps> = ({ owner }) => {
  const { user, followUser, unfollowUser } = useAuthContext();
  const [pending, setPending] = useState(false);

  const initial = (owner.username || "?").charAt(0).toUpperCase();
  const isFollowing = (user?.following ?? []).includes(owner.uid);

  const toggleFollow = async () => {
    if (!user || pending) return;
    setPending(true);
    try {
      await (isFollowing ? unfollowUser(owner.uid) : followUser(owner.uid));
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast.error("That didn't save. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="border border-ns-border rounded-ns-lg bg-ns-surface p-4">
      <div className="flex items-center gap-2.5">
        <div className="w-[38px] h-[38px] flex-shrink-0 rounded-full bg-ns-teal text-white flex items-center justify-center font-ui font-bold text-sm">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="font-ui text-[14.5px] font-bold text-ns-ink truncate">
            @{owner.username}
          </div>
          <div className="font-ui text-[11.5px] text-ns-ink-muted">
            {isFollowing ? "You follow them" : "Not followed yet"}
          </div>
        </div>
      </div>

      {owner.bio && (
        <p className="font-ui text-[13px] leading-relaxed text-ns-ink-secondary mt-2.5">
          {owner.bio}
        </p>
      )}

      {user && user.uid !== owner.uid && (
        <button
          type="button"
          onClick={toggleFollow}
          disabled={pending}
          className={`w-full text-center font-ui text-[13px] font-semibold py-2 rounded-full border transition-colors mt-3 disabled:opacity-50 ${
            isFollowing
              ? "bg-ns-teal-subtle border-ns-teal-border text-ns-teal"
              : "bg-ns-bg border-ns-border text-ns-accent hover:border-ns-border-strong"
          }`}
        >
          {isFollowing ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
};

export default AboutOwner;
