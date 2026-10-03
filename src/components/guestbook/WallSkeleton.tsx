import React from "react";

const pulse = "animate-pulse rounded bg-ns-surface";

const BODY_LINES = [
  ["w-full", "w-4/5"],
  ["w-full", "w-11/12", "w-1/2"],
  ["w-3/4"],
];

const WallPostSkeleton: React.FC<{ lines: string[] }> = ({ lines }) => (
  <div className="border border-ns-border rounded-ns-lg bg-ns-elevated px-5 py-[18px]">
    <div className="flex items-center gap-[11px]">
      <div className="w-[38px] h-[38px] flex-shrink-0 rounded-full animate-pulse bg-ns-surface" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className={`h-3.5 w-40 max-w-full ${pulse}`} />
        <div className={`h-3 w-28 ${pulse}`} />
      </div>
    </div>
    <div className="mt-4 space-y-2.5">
      {lines.map((width, i) => (
        <div key={i} className={`h-4 ${width} ${pulse}`} />
      ))}
    </div>
    <div className="flex items-center gap-1.5 mt-4">
      <div className="h-[34px] w-14 animate-pulse rounded-full bg-ns-surface" />
      <div className="h-[34px] w-20 animate-pulse rounded-full bg-ns-surface" />
    </div>
  </div>
);

/** Post-shaped placeholders, so the feed keeps its height while it loads. */
export const WallFeedSkeleton: React.FC = () => (
  <div
    className="flex flex-col gap-3.5"
    role="status"
    aria-label="Loading posts"
  >
    {BODY_LINES.map((lines, i) => (
      <WallPostSkeleton key={i} lines={lines} />
    ))}
  </div>
);

/**
 * The guestbook page before its chunk, the viewer's identity or the visited
 * profile is known. Mirrors the pages' own container and grid so the feed
 * column does not move when the real page replaces it.
 */
export const WallPageSkeleton: React.FC<{ title?: string }> = ({ title }) => (
  <div className="min-h-screen bg-ns-bg">
    <div className="max-w-[1320px] mx-auto px-4 sm:px-10 py-8 sm:py-9">
      <header className="mb-6">
        {title ? (
          <h1 className="font-heading text-3xl sm:text-[44px] text-ns-ink leading-none tracking-[-0.015em]">
            {title}
          </h1>
        ) : (
          <div className={`h-[30px] sm:h-[44px] w-72 max-w-full ${pulse}`} />
        )}
        <div className="mt-3.5 flex gap-4">
          <div className={`h-7 w-16 ${pulse}`} />
          <div className={`h-7 w-20 ${pulse}`} />
        </div>
      </header>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[248px_minmax(0,1fr)_268px] lg:gap-10">
        <div className="min-w-0 flex flex-col gap-[22px] lg:col-start-2">
          <div className="h-28 animate-pulse rounded-ns-lg border border-ns-border bg-ns-surface" />
          <WallFeedSkeleton />
        </div>
      </div>
    </div>
  </div>
);
