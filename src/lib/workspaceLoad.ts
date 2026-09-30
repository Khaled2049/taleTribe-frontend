import type { Chapter, Story } from "@novelsync/story-data-client";

export type WorkspaceLoad =
  | { status: "loaded"; story: Story; chapters: Chapter[] }
  | { status: "missing" }
  | { status: "error"; error: unknown };

export interface WorkspaceReader {
  getStory(storyId: string): Promise<Story | null>;
  getChapters(story: Story): Promise<Chapter[]>;
}

/** Never rejects, so the caller always leaves its loading state. */
export async function loadWorkspace(
  repo: WorkspaceReader,
  storyId: string,
): Promise<WorkspaceLoad> {
  try {
    const story = await repo.getStory(storyId);
    if (!story) return { status: "missing" };
    const chapters = await repo.getChapters(story);
    return { status: "loaded", story, chapters };
  } catch (error) {
    return { status: "error", error };
  }
}
