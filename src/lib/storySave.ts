import {
  StoryDataConflictError,
  StoryDataError,
  type Story,
} from "@novelsync/story-data-client";

interface StoryRepo {
  getStory(storyId: string): Promise<Story | null>;
  updateStory(story: Story): Promise<Story>;
}

export type StoryEdits = Partial<Pick<Story, "title" | "paragraphStyle">>;

/**
 * Saves the fields the editor owns. When the story changed elsewhere the edits
 * are re-applied to the current copy instead of failing or overwriting
 * metadata this session never touched.
 */
export async function saveStoryEdits(
  repo: StoryRepo,
  story: Story,
  edits: StoryEdits,
): Promise<Story> {
  try {
    return await repo.updateStory({ ...story, ...edits });
  } catch (error) {
    if (!(error instanceof StoryDataConflictError)) throw error;
    const current = await repo.getStory(story.id);
    if (!current) throw error;
    return repo.updateStory({ ...current, ...edits });
  }
}

/**
 * True for failures a later attempt can fix on its own: the network dropping
 * (fetch rejects with a TypeError) or the server being briefly unavailable.
 * A conflict or a rejected payload fails the same way every time.
 */
export function isRetryableSaveError(error: unknown): boolean {
  if (error instanceof StoryDataError) {
    return error.status >= 500 || error.status === 429 || error.status === 408;
  }
  return error instanceof TypeError;
}
