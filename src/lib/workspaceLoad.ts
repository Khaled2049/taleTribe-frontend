import type {
  Chapter,
  ChapterSummary,
  Story,
} from "@novelsync/story-data-client";

export type WorkspaceLoad =
  | {
      status: "loaded";
      story: Story;
      chapters: ChapterSummary[];
      currentChapter: Chapter | null;
    }
  | { status: "missing" }
  | { status: "error"; error: unknown };

export interface WorkspaceReader {
  getStory(storyId: string): Promise<Story | null>;
  getChapterIndex(storyId: string): Promise<ChapterSummary[]>;
  getChapter(storyId: string, chapterId: string): Promise<Chapter | null>;
}

/**
 * Reads the story and chapter index in parallel, then the requested chapter's
 * body, or the first's. Never rejects, so the caller always leaves its loading
 * state.
 */
export async function loadWorkspace(
  repo: WorkspaceReader,
  storyId: string,
  requestedChapterId?: string | null,
): Promise<WorkspaceLoad> {
  try {
    const index = repo.getChapterIndex(storyId);
    // A missing story 404s the index too; report it as missing, not an error.
    index.catch(() => {});
    const requested = requestedChapterId
      ? repo.getChapter(storyId, requestedChapterId).catch(() => null)
      : null;
    const story = await repo.getStory(storyId);
    if (!story) return { status: "missing" };
    const chapters = await index;
    const target =
      chapters.find((chapter) => chapter.id === requestedChapterId) ??
      chapters[0];
    const early = target?.id === requestedChapterId ? await requested : null;
    const currentChapter = target
      ? (early ?? (await repo.getChapter(storyId, target.id)))
      : null;
    return { status: "loaded", story, chapters, currentChapter };
  } catch (error) {
    return { status: "error", error };
  }
}
