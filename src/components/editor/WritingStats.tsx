import { Chapter } from "@novelsync/story-data-client";
import { CHAPTER_WORD_LIMIT, chapterWordCount } from "@/utils/chapterWordLimit";

interface WritingStatsProps {
  currentChapter: Chapter | null;
  chaptersCount: number;
  pageCount?: number;
  textCharacterCount?: number;
  textWordCount?: number;
  singleDocument?: boolean;
}

export function WritingStats({
  currentChapter,
  chaptersCount,
  pageCount,
  textCharacterCount,
  textWordCount,
  singleDocument = false,
}: WritingStatsProps) {
  const wordCount = chapterWordCount(currentChapter?.content ?? "");

  const characterCount =
    textCharacterCount ?? currentChapter?.content?.length ?? 0;

  const readingTime = Math.ceil((textWordCount ?? wordCount) / 200);

  const progressPercent = Math.min((wordCount / CHAPTER_WORD_LIMIT) * 100, 100);
  const isNearLimit = progressPercent >= 80;
  const isAtLimit = progressPercent >= 100;

  const wordTone = isAtLimit
    ? "text-ns-destructive"
    : isNearLimit
      ? "text-amber-500"
      : "text-ns-ink";

  return (
    <div className="space-y-3">
      <p className="text-[10px] tracking-[0.09em] uppercase text-ns-ink-muted font-ui">
        Details
      </p>

      <div>
        <div className="flex justify-between items-baseline mb-1.5 font-ui text-xs">
          <span className="text-ns-ink-secondary">Words</span>
          <span className={`font-medium tabular-nums ${wordTone}`}>
            {wordCount.toLocaleString()} / {CHAPTER_WORD_LIMIT.toLocaleString()}
          </span>
        </div>
        <div
          className="w-full bg-ns-surface-hover rounded-full h-1.5 overflow-hidden"
          role="progressbar"
          aria-valuenow={wordCount}
          aria-valuemin={0}
          aria-valuemax={CHAPTER_WORD_LIMIT}
          aria-label="Chapter words used"
        >
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              isAtLimit
                ? "bg-ns-destructive"
                : isNearLimit
                  ? "bg-amber-500"
                  : "bg-ns-accent"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {isNearLimit && !isAtLimit && (
          <p className="font-ui text-[11px] text-amber-500 mt-1.5">
            Approaching the chapter word limit.
          </p>
        )}
        {isAtLimit && (
          <p className="font-ui text-[11px] text-ns-destructive mt-1.5">
            {singleDocument
              ? "Word limit reached — split this document into chapters to keep writing."
              : "Chapter word limit reached — start a new chapter to keep writing."}
          </p>
        )}
      </div>

      <div className="space-y-1.5 font-ui text-xs">
        <Row label="Characters" value={characterCount.toLocaleString()} />
        <Row label="Reading time" value={`${readingTime} min`} />
        {pageCount !== undefined && (
          <Row label="Pages" value={String(pageCount)} />
        )}
        <Row label="Chapters" value={String(chaptersCount)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ns-ink-secondary">{label}</span>
      <span className="text-ns-ink font-medium tabular-nums">{value}</span>
    </div>
  );
}
