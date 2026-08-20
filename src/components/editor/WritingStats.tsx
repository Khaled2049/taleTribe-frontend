import { Chapter } from "@novelsync/story-data-client";

const WORD_LIMIT = 5000;

interface WritingStatsProps {
  currentChapter: Chapter | null;
  chaptersCount: number;
  pageCount?: number;
}

export function WritingStats({
  currentChapter,
  chaptersCount,
  pageCount = 1,
}: WritingStatsProps) {
  const wordCount = currentChapter?.content
    ? currentChapter.content.split(/\s+/).filter(Boolean).length
    : 0;

  const characterCount = currentChapter?.content?.length || 0;

  const readingTime = currentChapter?.content
    ? Math.ceil(
        currentChapter.content.split(/\s+/).filter(Boolean).length / 200,
      )
    : 0;

  const progressPercent = Math.min((wordCount / WORD_LIMIT) * 100, 100);
  const isNearLimit = progressPercent >= 80;
  const isAtLimit = progressPercent >= 100;

  return (
    <>
      <h3 className="text-lg font-semibold mb-4 text-black dark:text-white">
        Writing Stats
      </h3>
      <div className="space-y-4 text-sm text-black/70 dark:text-white/70">
        {/* Word count with progress bar */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span>Words:</span>
            <span
              className={`font-medium ${
                isAtLimit
                  ? "text-red-500"
                  : isNearLimit
                    ? "text-amber-500"
                    : "text-black dark:text-white"
              }`}
            >
              {wordCount.toLocaleString()} / {WORD_LIMIT.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isAtLimit
                  ? "bg-red-500"
                  : isNearLimit
                    ? "bg-amber-500"
                    : "bg-dark-green dark:bg-light-green"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {isNearLimit && !isAtLimit && (
            <p className="text-xs text-amber-500 mt-1.5">
              Approaching chapter limit
            </p>
          )}
          {isAtLimit && (
            <p className="text-xs text-red-500 mt-1.5">
              Chapter word limit reached
            </p>
          )}
        </div>

        <div className="flex justify-between">
          <span>Characters:</span>
          <span className="font-medium text-black dark:text-white">
            {characterCount.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Reading time:</span>
          <span className="font-medium text-black dark:text-white">
            {readingTime} min
          </span>
        </div>
        <div className="flex justify-between">
          <span>Pages:</span>
          <span className="font-medium text-black dark:text-white">
            {pageCount}
          </span>
        </div>
        <div className="flex justify-between pt-4 border-t border-black/10 dark:border-white/10">
          <span>Chapters:</span>
          <span className="font-medium text-black dark:text-white">
            {chaptersCount}
          </span>
        </div>
      </div>
    </>
  );
}
