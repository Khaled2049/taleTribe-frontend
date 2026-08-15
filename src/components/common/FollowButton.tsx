import React, { useState } from "react";
import { Check, Loader2, UserPlus } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";

interface FollowButtonProps {
  targetId: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Follow state comes from the viewer's own `following` array — the target's user
 * document is unreadable to anyone but its owner, so "do I follow them" is the
 * only side of the relationship a client can answer without a server call.
 */
const FollowButton: React.FC<FollowButtonProps> = ({
  targetId,
  size = "md",
  className = "",
}) => {
  const { user, followUser, unfollowUser } = useAuthContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  // Nothing to offer a signed-out visitor, and following yourself is meaningless.
  if (!user || user.uid === targetId) return null;

  const isFollowing = (user.following ?? []).includes(targetId);

  const toggle = async () => {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      await (isFollowing ? unfollowUser(targetId) : followUser(targetId));
    } catch (err) {
      console.error("Error toggling follow:", err);
      setError(true);
    } finally {
      setPending(false);
    }
  };

  const sizing =
    size === "sm"
      ? "px-2.5 py-1 text-[11px] gap-1"
      : "px-4 py-2 text-[13px] gap-1.5";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={isFollowing}
      title={error ? "That didn't save. Try again." : undefined}
      className={`
        inline-flex items-center rounded-ns font-ui font-medium
        transition-colors duration-150 disabled:opacity-60
        ${sizing}
        ${
          isFollowing
            ? "border border-ns-border bg-ns-surface text-ns-ink-secondary hover:border-ns-border-strong hover:text-ns-ink"
            : "bg-ns-accent text-white hover:bg-ns-accent-hover"
        }
        ${error ? "border-ns-destructive" : ""}
        ${className}
      `}
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isFollowing ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <UserPlus className="w-3.5 h-3.5" />
      )}
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
};

export default FollowButton;
