import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoteButtonsProps {
  upvoteCount: number;
  downvoteCount: number;
  userVote: "up" | "down" | null | undefined;
  onVote: (voteType: "up" | "down" | null) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  size?: "sm" | "default";
}

const VoteButtons: React.FC<VoteButtonsProps> = ({
  upvoteCount,
  downvoteCount,
  userVote,
  onVote,
  isLoading = false,
  disabled = false,
  size = "default",
}) => {
  const handleVote = async (voteType: "up" | "down") => {
    if (disabled || isLoading) return;

    // Toggle: if clicking the same button, remove vote
    const newVote = userVote === voteType ? null : voteType;
    await onVote(newVote);
  };

  const iconSize = size === "sm" ? 16 : 18;
  const buttonSize = size === "sm" ? "sm" : "default";

  return (
    <div className="flex items-center gap-0.5">
      {/* Upvote Button */}
      <Button
        variant="ghost"
        size={buttonSize}
        onClick={() => handleVote("up")}
        disabled={disabled || isLoading}
        className={`flex items-center gap-1 px-2 rounded-full ${
          userVote === "up"
            ? "text-ns-accent bg-ns-accent-subtle hover:bg-ns-accent-subtle"
            : "text-ns-ink-muted hover:text-ns-accent hover:bg-ns-surface-hover"
        }`}
      >
        <ChevronUp size={iconSize} />
        <span className="text-xs font-medium tabular-nums">{upvoteCount}</span>
      </Button>

      {/* Downvote Button */}
      <Button
        variant="ghost"
        size={buttonSize}
        onClick={() => handleVote("down")}
        disabled={disabled || isLoading}
        className={`flex items-center gap-1 px-2 rounded-full ${
          userVote === "down"
            ? "text-ns-destructive bg-ns-destructive/10 hover:bg-ns-destructive/10"
            : "text-ns-ink-muted hover:text-ns-destructive hover:bg-ns-surface-hover"
        }`}
      >
        <ChevronDown size={iconSize} />
        <span className="text-xs font-medium tabular-nums">
          {downvoteCount}
        </span>
      </Button>
    </div>
  );
};

export default VoteButtons;
