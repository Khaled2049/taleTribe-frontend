import React, { useState } from "react";

/**
 * "Since you were last here" — placeholder demo content.
 *
 * There is no last-visit tracking or notification system yet, so this card
 * cannot be wired to real data: doing so would mean inventing a fake
 * last-seen mechanism this pass. Hardcoded per explicit direction, same as
 * WriterSuggestions. Replace with a real feed once story-data has a
 * per-user last-seen timestamp (and ideally real notification events) to
 * back it — see the digest rules in design_handoff_guestbook_wall/README.md.
 */
const DEMO_DIGEST = [
  {
    initial: "W",
    handle: "@WildScribbler82",
    action: "published a chapter",
    title: "The Keeper of Small Hours — Ch. 7",
    time: "2 hours ago",
    cta: "Read",
  },
  {
    initial: "E",
    handle: "@e2e_user",
    action: "entered a competition",
    title: "Carriage D, Northbound",
    time: "Yesterday",
    cta: "Read",
  },
  {
    initial: "W",
    handle: "@WildScribbler82",
    action: "left a note on your page",
    title: '"Your last piece stayed with me all week…"',
    time: "Yesterday",
    cta: "Reply",
  },
];
const DEMO_SUMMARY =
  "3 updates from 2 of the 2 people you follow · last visit Tuesday";

const WallDigest: React.FC = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-ns-border rounded-ns-lg bg-ns-surface overflow-hidden">
      <div className="px-4 pt-[15px] pb-3">
        <div className="font-heading text-[19px] leading-tight text-ns-ink">
          Since you were last here
        </div>
        <div className="font-ui text-[12.5px] text-ns-ink-secondary leading-snug mt-1">
          {DEMO_SUMMARY}
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="mt-2.5 font-ui text-[12.5px] font-bold text-ns-accent border border-ns-border bg-ns-elevated rounded-full px-3 py-[5px] hover:border-ns-border-strong transition-colors"
        >
          {open ? "Collapse" : `Show ${DEMO_DIGEST.length}`}
        </button>
      </div>

      {open && (
        <div className="flex flex-col border-t border-ns-border">
          {DEMO_DIGEST.map((item, i) => (
            <div
              key={i}
              className="flex gap-2.5 px-4 py-3 border-b border-ns-border items-start"
            >
              <div className="w-7 h-7 flex-shrink-0 rounded-full bg-ns-accent text-white flex items-center justify-center font-ui font-bold text-xs">
                {item.initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-ui text-[12.5px] leading-snug">
                  <span className="font-bold text-ns-ink">{item.handle}</span>{" "}
                  <span className="text-ns-ink-secondary">{item.action}</span>
                </div>
                <div className="font-heading text-[15px] leading-snug mt-0.5 text-ns-ink">
                  {item.title}
                </div>
                <div className="flex items-baseline gap-2.5 mt-1">
                  <span className="font-ui text-[11.5px] text-ns-ink-muted">
                    {item.time}
                  </span>
                  <span className="font-ui text-xs font-bold text-ns-accent cursor-default">
                    {item.cta}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <div className="px-4 py-[11px] font-ui text-xs text-ns-ink-secondary flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-bold text-ns-accent text-left"
            >
              Mark all as seen
            </button>
            <span>Digest email: weekly</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WallDigest;
