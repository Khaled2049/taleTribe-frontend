import { BookOpen } from "lucide-react";
import type { IReadingProgress } from "@novelsync/story-data-client";
import { BookCoverFallback } from "@/components/story/BookCoverFallback";

interface ContinueReadingListProps {
  items: IReadingProgress[];
  loading: boolean;
  /** The caller reports the error itself; the list only steps aside. */
  error: boolean;
  onOpen: (storyId: string) => void;
  onClear: () => void;
  onExplore: () => void;
}

export const ContinueReadingList = ({
  items,
  loading,
  error,
  onOpen,
  onClear,
  onExplore,
}: ContinueReadingListProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-ns-ink-muted font-ui text-sm">Loading…</span>
      </div>
    );
  }

  if (error) return null;

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-ns-surface border border-ns-border flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-ns-ink-muted" />
        </div>
        <h2 className="font-heading text-2xl text-ns-ink mb-2">
          Nothing in progress
        </h2>
        <p className="font-ui text-sm text-ns-ink-secondary mb-6">
          Stories you start reading will show up here.
        </p>
        <button
          onClick={onExplore}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-ns-accent hover:bg-ns-accent-hover text-white text-sm font-ui font-medium rounded-ns transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          Explore stories
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={onClear}
          className="font-ui text-xs text-ns-ink-muted hover:text-ns-destructive transition-colors"
        >
          Clear all
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => {
          const progressPct =
            item.totalChapters > 1
              ? Math.round((item.chapterIndex / (item.totalChapters - 1)) * 100)
              : 100;
          return (
            <div
              key={item.storyId}
              className="group flex gap-4 p-4 bg-ns-surface border border-ns-border rounded-ns-lg hover:border-ns-border-strong hover:shadow-ns transition-all duration-200 cursor-pointer"
              onClick={() => onOpen(item.storyId)}
            >
              <div className="flex-shrink-0 w-14 h-[80px] rounded overflow-hidden ring-1 ring-ns-border/50 shadow-sm">
                {item.coverImageUrl ? (
                  <img
                    src={item.thumbnailUrl || item.coverImageUrl}
                    alt={item.storyTitle}
                    width={56}
                    height={80}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookCoverFallback
                    title={item.storyTitle}
                    author={item.storyAuthor}
                    size="small"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <p className="font-ui text-sm font-semibold text-ns-ink truncate leading-snug">
                    {item.storyTitle}
                  </p>
                  <p className="font-ui text-xs text-ns-ink-secondary truncate mt-0.5">
                    {item.storyAuthor}
                  </p>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-ui text-[10px] text-ns-ink-muted">
                      Ch. {item.chapterIndex + 1} of {item.totalChapters}
                    </span>
                    <span className="font-ui text-[10px] text-ns-ink-muted">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="h-0.5 w-full bg-ns-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ns-accent rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(item.storyId);
                  }}
                  className="mt-3 self-start inline-flex items-center gap-1.5 px-3 py-1 bg-ns-accent text-white font-ui text-xs font-medium rounded-ns hover:bg-ns-accent-hover transition-colors"
                >
                  <BookOpen className="w-3 h-3" />
                  Continue
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
