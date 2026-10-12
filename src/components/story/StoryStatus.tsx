import type { CompletionStatus, Story } from "@novelsync/story-data-client";
import { Check } from "lucide-react";
import { STATUS_LABELS, readerUpdateView } from "@/lib/storyStatus";

/** Renders nothing for a story from an endpoint that does not carry a status. */
export function StoryStatusBadge({
  status,
  variant = "default",
  className = "",
}: {
  status?: CompletionStatus;
  variant?: "default" | "cover";
  className?: string;
}) {
  if (!status) return null;
  const cover = variant === "cover";
  const style = cover
    ? `inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-ui text-[8px] font-semibold leading-[14px] tracking-[0.01em] shadow-ns-sm sm:px-2 sm:text-[9px] ${
        status === "completed"
          ? "bg-[#f7efe3] text-[#365c45]"
          : "bg-[#29343b]/95 text-white"
      }`
    : `inline-block rounded-ns px-1.5 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wider ${
        status === "completed"
          ? "bg-ns-accent text-white"
          : "bg-ns-elevated text-ns-ink-secondary border border-ns-border"
      }`;
  return (
    <span
      data-cy="story-status"
      className={`shrink-0 whitespace-nowrap ${style} ${className}`}
    >
      {cover &&
        (status === "completed" ? (
          <Check
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0"
            strokeWidth={3}
          />
        ) : (
          <span
            aria-hidden="true"
            className="mx-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e7b16b] ring-2 ring-[#e7b16b]/25"
          />
        ))}
      {STATUS_LABELS[status]}
    </span>
  );
}

/** The author's word to readers: when the next chapter is due, and their note. */
export function StoryReaderUpdate({
  story,
  className = "",
}: {
  story: Pick<Story, "completionStatus" | "nextChapterOn" | "readerNote">;
  className?: string;
}) {
  const update = readerUpdateView(story);
  if (!update) return null;
  return (
    <aside
      data-cy="reader-update"
      aria-label="Update from the author"
      className={`rounded-ns border border-ns-border bg-ns-surface px-4 py-3 ${className}`}
    >
      {update.nextChapter && (
        <p className="font-ui text-sm font-medium text-ns-ink">
          Next chapter expected {update.nextChapter}
        </p>
      )}
      {update.note && (
        <p className="font-body text-base text-ns-ink-secondary whitespace-pre-line">
          {update.note}
        </p>
      )}
    </aside>
  );
}
