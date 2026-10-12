import type {
  CompletionStatus,
  Story,
  StoryWorkspaceRepo,
} from "@novelsync/story-data-client";
import { normalizeReaderUpdate, readerUpdateOf } from "./readerUpdate";

/** Save the chosen status while private, then publish the story. */
export async function publishStory(
  repo: Pick<StoryWorkspaceRepo, "updateReaderUpdate" | "updateStory">,
  story: Story,
  completionStatus: CompletionStatus,
  onStatusSaved: (story: Story) => void,
): Promise<Story> {
  let current = story;
  if ((story.completionStatus ?? "ongoing") !== completionStatus) {
    current = await repo.updateReaderUpdate(
      story.id,
      normalizeReaderUpdate({ ...readerUpdateOf(story), completionStatus }),
    );
    // Keep the editor in step even if publishing fails after this save.
    onStatusSaved(current);
  }
  return repo.updateStory({ ...current, isPublished: true });
}
