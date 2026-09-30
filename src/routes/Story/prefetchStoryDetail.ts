import type { QueryClient } from "@tanstack/react-query";
import { appQueryClient } from "@/lib/queryClient";
import {
  publicChapterQuery,
  publicStoryQuery,
} from "@/hooks/queries/publicStory";

export function prefetchStoryDetail(
  storyId: string,
  queryClient: QueryClient = appQueryClient,
) {
  import("./StoryDetail").catch(() => undefined);
  return queryClient.prefetchQuery(publicStoryQuery(storyId));
}

export async function prefetchReaderChapter(
  storyId: string,
  chapterId: string,
  queryClient: QueryClient = appQueryClient,
) {
  const detail = await queryClient
    .ensureQueryData(publicStoryQuery(storyId))
    .catch(() => null);
  if (!detail) return;
  await queryClient.prefetchQuery(
    publicChapterQuery(storyId, chapterId, detail.story.userId),
  );
}
