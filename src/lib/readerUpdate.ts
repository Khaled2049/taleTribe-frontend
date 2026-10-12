import type { ReaderUpdate, Story } from "@novelsync/story-data-client";

/** KEEP IN SYNC with `maxReaderNoteChars` in story-data. */
export const READER_NOTE_MAX = 280;

type ReaderFields = Pick<
  Story,
  "completionStatus" | "nextChapterOn" | "readerNote"
>;

export function readerUpdateOf(story: ReaderFields): ReaderUpdate {
  return {
    completionStatus: story.completionStatus ?? "ongoing",
    nextChapterOn: story.nextChapterOn ?? "",
    readerNote: story.readerNote ?? "",
  };
}

/** The update as story-data will store it: trimmed, and no date once completed. */
export function normalizeReaderUpdate(update: ReaderUpdate): ReaderUpdate {
  return {
    completionStatus: update.completionStatus,
    nextChapterOn:
      update.completionStatus === "completed" ? "" : update.nextChapterOn,
    readerNote: update.readerNote.trim(),
  };
}

export function readerUpdateChanged(
  story: ReaderFields,
  update: ReaderUpdate,
): boolean {
  const before = readerUpdateOf(story);
  const after = normalizeReaderUpdate(update);
  return (
    before.completionStatus !== after.completionStatus ||
    before.nextChapterOn !== after.nextChapterOn ||
    before.readerNote !== after.readerNote
  );
}

type MetadataEdits = Partial<
  Pick<
    Story,
    | "title"
    | "description"
    | "category"
    | "targetAudience"
    | "language"
    | "copyright"
    | "tags"
  >
>;

/**
 * Whether an edit form's metadata differs from the stored story. A story PATCH
 * moves the story up in discovery, so a save that only touched the reader
 * update must not send one. Unset and empty are the same value here.
 */
export function storyMetadataChanged(
  story: MetadataEdits,
  edits: MetadataEdits,
): boolean {
  const text = (value: unknown) =>
    Array.isArray(value) ? value.join("\u0000") : String(value ?? "");
  return (Object.keys(edits) as (keyof MetadataEdits)[]).some(
    (key) => text(story[key]) !== text(edits[key]),
  );
}

/** Today in the author's own timezone, for a date input's `min`. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
