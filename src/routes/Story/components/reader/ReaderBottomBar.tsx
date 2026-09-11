// src/components/reader/ReaderBottomBar.tsx

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ReaderBottomBarProps {
  theme: {
    bg: string;
    text: string;
    border: string;
    hover: string;
  };
  currentChapterIndex: number;
  totalChapters: number;
  /** Live scroll fraction (0–1) within the current chapter. */
  scrollPercent: number;
  /** Estimated minutes left in the current chapter. */
  minutesRemaining: number;
  onPrevChapter: () => void;
  onNextChapter: () => void;
}

export const ReaderBottomBar: React.FC<ReaderBottomBarProps> = ({
  theme,
  currentChapterIndex,
  totalChapters,
  scrollPercent,
  minutesRemaining,
  onPrevChapter,
  onNextChapter,
}) => {
  // Combine chapter position + intra-chapter scroll into one continuous,
  // monotonic fraction across the whole book.
  const progress =
    totalChapters > 0
      ? ((currentChapterIndex + Math.min(1, Math.max(0, scrollPercent))) /
          totalChapters) *
        100
      : 0;
  const isFirst = currentChapterIndex === 0;
  const isLast = currentChapterIndex === totalChapters - 1;
  const hasChapterNav = totalChapters > 1;

  return (
    <div
      className={`fixed bottom-0 left-0 w-full ${theme.bg} border-t ${theme.border} shadow-lg transition-colors duration-300`}
    >
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          {hasChapterNav && (
            <button
              onClick={onPrevChapter}
              disabled={isFirst}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${theme.hover} ${theme.text} disabled:opacity-30 disabled:cursor-not-allowed`}
              aria-label="Previous chapter"
            >
              <ChevronLeft size={16} />
              Prev
            </button>
          )}

          <div className="flex flex-col items-center leading-tight">
            {hasChapterNav && (
              <span
                className={`text-sm font-medium ${theme.text} tabular-nums`}
              >
                {currentChapterIndex + 1} / {totalChapters}
              </span>
            )}
            {minutesRemaining > 0 && (
              <span className={`text-xs ${theme.text} opacity-50 tabular-nums`}>
                ~{minutesRemaining} min left{hasChapterNav ? " in chapter" : ""}
              </span>
            )}
          </div>

          {hasChapterNav && (
            <button
              onClick={onNextChapter}
              disabled={isLast}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${theme.hover} ${theme.text} disabled:opacity-30 disabled:cursor-not-allowed`}
              aria-label="Next chapter"
            >
              Next
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-2 w-full bg-current opacity-10 rounded-full h-1">
          <div
            className="bg-ns-accent-deep h-1 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Reading progress: ${Math.round(progress)}%`}
          />
        </div>
      </div>
    </div>
  );
};
