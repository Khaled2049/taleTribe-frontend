import React from "react";

export type PeopleSegment = "all" | "following" | "followers" | "new";
export type PeopleSort = "newest" | "az";

interface PeopleSegmentsProps {
  segment: PeopleSegment;
  onSegmentChange: (segment: PeopleSegment) => void;
  sort: PeopleSort;
  onSortChange: (sort: PeopleSort) => void;
}

const SEGMENTS: { value: PeopleSegment; label: string }[] = [
  { value: "all", label: "All members" },
  { value: "following", label: "Following" },
  { value: "followers", label: "Follows you" },
  { value: "new", label: "New this week" },
];

const SORTS: { value: PeopleSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "az", label: "A–Z" },
];

export const GROUP_LABELS: Record<PeopleSegment, string> = {
  all: "Everyone · newest first",
  following: "People you follow",
  followers: "They follow you",
  new: "Joined in the last 7 days",
};

const PeopleSegments: React.FC<PeopleSegmentsProps> = ({
  segment,
  onSegmentChange,
  sort,
  onSortChange,
}) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {SEGMENTS.map((s) => {
        const active = s.value === segment;
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => onSegmentChange(s.value)}
            className={`font-ui text-[13px] font-semibold px-[14px] py-[7px] rounded-full border transition-colors ${
              active
                ? "bg-ns-accent border-ns-accent text-white"
                : "bg-ns-bg border-ns-border text-ns-ink-secondary hover:border-ns-border-strong"
            }`}
          >
            {s.label}
          </button>
        );
      })}

      <div className="ml-auto flex items-center gap-3.5">
        <span className="font-ui text-[12.5px] text-ns-ink-muted">Sort</span>
        {SORTS.map((o) => {
          const active = o.value === sort;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onSortChange(o.value)}
              className={`font-ui text-[12.5px] pb-0.5 border-b transition-colors ${
                active
                  ? "font-bold text-ns-accent border-ns-accent"
                  : "font-medium text-ns-ink-muted border-transparent hover:text-ns-ink-secondary"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PeopleSegments;
