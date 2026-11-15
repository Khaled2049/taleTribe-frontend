import React from "react";
import { BookOpen, Skull } from "lucide-react";
import { FeedMode } from "@/lib/feedPaging";

interface FeedModeToggleProps {
  mode: FeedMode;
  onChange: (mode: FeedMode) => void;
}

const OPTIONS: {
  value: FeedMode;
  label: string;
  icon: typeof BookOpen;
  title: string;
}[] = [
  {
    value: "pages",
    label: "Pages",
    icon: BookOpen,
    title: "Ten posts at a time, with a bottom you can actually reach",
  },
  {
    value: "scroll",
    label: "Doom scroll",
    icon: Skull,
    title: "Infinite scroll. We won't stop you. We will judge you a little.",
  },
];

const FeedModeToggle: React.FC<FeedModeToggleProps> = ({ mode, onChange }) => (
  <div className="flex items-center gap-3 flex-wrap">
    <div
      role="group"
      aria-label="How the feed loads"
      className="inline-flex rounded-full border border-ns-border bg-ns-surface p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon, title }) => {
        const active = value === mode;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={title}
            onClick={() => onChange(value)}
            className={`inline-flex items-center gap-1.5 font-ui text-[12.5px] font-semibold px-3 py-1.5 rounded-full transition-colors ${
              active
                ? "bg-ns-elevated text-ns-ink shadow-ns"
                : "text-ns-ink-muted hover:text-ns-ink-secondary"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
    {mode === "scroll" && (
      <span className="font-ui text-[12px] text-ns-ink-muted">
        Doom mode on. No judgement. (Some judgement.)
      </span>
    )}
  </div>
);

export default FeedModeToggle;
