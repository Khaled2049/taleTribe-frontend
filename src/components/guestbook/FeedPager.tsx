import React from "react";
import { ChevronLeft, ChevronRight, Loader } from "lucide-react";
import { pageItems } from "@/lib/pagination";
import { pageQuip } from "@/lib/feedPaging";

interface FeedPagerProps {
  /** 1-based. */
  page: number;
  total: number;
  isLastPage: boolean;
  loadingPage: number | null;
  showHints: boolean;
  onDismissHints: () => void;
  onChange: (page: number) => void;
}

/** A wobbly hand-drawn arrow; `flip` points it down-right instead of down-left. */
const DoodleArrow: React.FC<{ flip?: boolean; className?: string }> = ({
  flip,
  className,
}) => (
  <svg
    viewBox="0 0 64 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    style={flip ? { transform: "scaleX(-1)" } : undefined}
  >
    <path d="M58 4c-14 2-30 8-38 20-4 6-6 12-7 19" />
    <path d="M6 35l7 9 8-8" />
  </svg>
);

const navButton =
  "inline-flex items-center gap-1 font-ui text-[13px] font-semibold px-3 py-2 rounded-full border border-ns-border bg-ns-elevated text-ns-ink-secondary hover:border-ns-border-strong transition-colors disabled:opacity-40 disabled:pointer-events-none";

const FeedPager: React.FC<FeedPagerProps> = ({
  page,
  total,
  isLastPage,
  loadingPage,
  showHints,
  onDismissHints,
  onChange,
}) => {
  const busy = loadingPage !== null;

  return (
    <nav aria-label="Feed pages" className="pt-6 pb-2 text-center">
      {showHints && (
        <div
          aria-hidden="true"
          className="relative mx-auto mb-1 flex max-w-md items-end justify-between px-2 text-ns-accent"
        >
          <div className="flex flex-col items-start">
            <span className="font-heading italic text-[15px] leading-tight -rotate-3">
              these little numbers are <b>pages</b>
            </span>
            <DoodleArrow flip className="ml-10 h-9 w-12" />
          </div>
          {!isLastPage && (
            <div className="flex flex-col items-end">
              <span className="font-heading italic text-[15px] leading-tight rotate-2">
                click for more posts. no scrolling required!
              </span>
              <DoodleArrow className="mr-6 h-9 w-12" />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <button
          type="button"
          className={navButton}
          disabled={page <= 1 || busy}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={14} /> Newer
        </button>

        {pageItems(page, total).map((item, i) =>
          item === null ? (
            <span
              key={`gap-${i}`}
              className="px-1 font-ui text-sm text-ns-ink-muted"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              aria-label={`Page ${item}`}
              disabled={busy}
              onClick={() => onChange(item)}
              className={`min-w-9 h-9 px-2 inline-flex items-center justify-center rounded-full font-ui text-[13px] font-bold border transition-colors disabled:opacity-60 ${
                item === page
                  ? "bg-ns-accent border-ns-accent text-white"
                  : "bg-ns-bg border-ns-border text-ns-ink-secondary hover:border-ns-border-strong"
              }`}
            >
              {loadingPage === item ? (
                <Loader className="animate-spin" size={14} />
              ) : (
                item
              )}
            </button>
          ),
        )}

        <button
          type="button"
          className={navButton}
          disabled={isLastPage || busy}
          onClick={() => onChange(page + 1)}
        >
          Older <ChevronRight size={14} />
        </button>
      </div>

      <p className="mt-3 font-ui text-[12.5px] text-ns-ink-muted">
        {pageQuip(page, isLastPage)}
      </p>
      {showHints && (
        <button
          type="button"
          onClick={onDismissHints}
          className="mt-1 font-ui text-[12px] text-ns-ink-muted underline underline-offset-2 hover:text-ns-ink-secondary"
        >
          I know how pages work, thanks
        </button>
      )}
    </nav>
  );
};

export default FeedPager;
