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
 * Reads the story and chapter index in parallel, then the first chapter's
 * body. Never rejects, so the caller always leaves its loading state.
 */
export async function loadWorkspace(
  repo: WorkspaceReader,
  storyId: string,
): Promise<WorkspaceLoad> {
  try {
    const index = repo.getChapterIndex(storyId);
    // A missing story 404s the index too; report it as missing, not an error.
    index.catch(() => {});
    const story = await repo.getStory(storyId);
    if (!story) return { status: "missing" };
    const chapters = await index;
    const first = chapters[0];
    const currentChapter = first
      ? await repo.getChapter(storyId, first.id)
      : null;
    return { status: "loaded", story, chapters, currentChapter };
  } catch (error) {
    return { status: "error", error };
  }
}
