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

/**
 * A handoff, not a cache: the guard starts it alongside the story read and the
 * editor removes it once consumed, since the editor's own state is the index
 * from then on.
 */
export const workspaceChapterIndexQuery = (uid: string, storyId: string) =>
  queryOptions({
    queryKey: queryKeys.workspace.chapterIndex(uid, storyId),
    queryFn: () => storyWorkspaceRepo.getChapterIndex(storyId, uid),
    staleTime: 1000 * 30,
  });

export const workspaceChapterQuery = (
  uid: string,
  storyId: string,
  chapterId: string,
) =>
  queryOptions({
    queryKey: queryKeys.workspace.chapter(uid, storyId, chapterId),
    queryFn: () => storyWorkspaceRepo.getChapter(storyId, chapterId, uid),
    staleTime: 1000 * 30,
  });
