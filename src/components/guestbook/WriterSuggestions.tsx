import React from "react";

/**
 * "Writers you may know" — placeholder demo content.
 *
 * There is no recommendation source in the product yet (no "followed by",
 * no similarity model), so these are not real accounts and "Follow" is
 * intentionally a no-op. Hardcoded per explicit direction, same as
 * WallDigest. Replace once there's a real suggestion source to query.
 */
const DEMO_SUGGESTIONS = [
  { initial: "D", handle: "@dev_user", why: "followed by @e2e_user" },
  { initial: "P", handle: "@PaperLanternX", why: "writes serials like yours" },
];

const WriterSuggestions: React.FC = () => {
  return (
    <div className="border border-ns-border rounded-ns-lg bg-ns-surface p-4">
      <div className="font-ui text-[11px] font-bold tracking-[0.14em] uppercase text-ns-ink-muted mb-2.5">
        Writers you may know
      </div>
      <div className="flex flex-col gap-3">
        {DEMO_SUGGESTIONS.map((s) => (
          <div key={s.handle} className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] flex-shrink-0 rounded-full bg-ns-ink-muted text-white flex items-center justify-center font-ui font-bold text-xs">
              {s.initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-ui text-[13.5px] font-semibold text-ns-ink truncate">
                {s.handle}
              </div>
              <div className="font-ui text-[11.5px] text-ns-ink-muted truncate">
                {s.why}
              </div>
            </div>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex-shrink-0 font-ui text-[12.5px] font-bold text-ns-accent border border-ns-border bg-ns-elevated rounded-full px-3 py-[5px] opacity-70 cursor-default"
            >
              Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WriterSuggestions;
