import { queryOptions } from "@tanstack/react-query";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import { queryKeys } from "./queryKeys";

/**
 * Shared by the workspace guard and the editor, so entering the editor reads
 * the story once. Kept out of useStoryQueries, which pulls in wagmi.
 */
export const workspaceStoryQuery = (uid: string, storyId: string) =>
  queryOptions({
    queryKey: queryKeys.workspace.story(uid, storyId),
    queryFn: () => storyWorkspaceRepo.getStory(storyId),
    staleTime: 1000 * 30,
  });
