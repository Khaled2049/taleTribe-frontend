import type { CompletionStatus, Story } from "@novelsync/story-data-client";
import { STATUS_LABELS, readerUpdateView } from "@/lib/storyStatus";

/** Renders nothing for a story from an endpoint that does not carry a status. */
export function StoryStatusBadge({
  status,
  className = "",
}: {
  status?: CompletionStatus;
  className?: string;
}) {
  if (!status) return null;
  return (
    <span
      data-cy="story-status"
      className={`inline-block rounded-ns px-1.5 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wider ${
        status === "completed"
          ? "bg-ns-accent text-white"
          : "bg-ns-elevated text-ns-ink-secondary border border-ns-border"
      } ${className}`}
    >
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
