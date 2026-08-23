import React from "react";

interface YourCircleProps {
  followingCount: number;
  followersCount: number;
  mutualCount: number;
}

const YourCircle: React.FC<YourCircleProps> = ({
  followingCount,
  followersCount,
  mutualCount,
}) => {
  const note =
    mutualCount > 0
      ? `${mutualCount} of the people you follow follow you back. Notes on your page come from anyone.`
      : "Notes on your page come from anyone, not just people you follow.";

  return (
    <div className="border border-ns-border rounded-ns-lg bg-ns-surface p-4">
      <div className="font-heading text-[19px] leading-tight text-ns-ink">
        Your circle
      </div>
      <div className="flex gap-[22px] mt-3">
        <div>
          <div className="font-heading text-[26px] leading-none text-ns-ink">
            {followingCount}
          </div>
          <div className="font-ui text-xs text-ns-ink-muted mt-0.5">
            following
          </div>
        </div>
        <div>
          <div className="font-heading text-[26px] leading-none text-ns-ink">
            {followersCount}
          </div>
          <div className="font-ui text-xs text-ns-ink-muted mt-0.5">
            followers
          </div>
        </div>
      </div>
      <p className="font-ui text-[12.5px] leading-relaxed text-ns-ink-secondary mt-3">
        {note}
      </p>
    </div>
  );
};

export default YourCircle;
