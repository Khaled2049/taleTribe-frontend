import type { QueryClient } from "@tanstack/react-query";
import {
  publicChapterQuery,
  publicStoryQuery,
} from "../../hooks/queries/publicStory.js";

export function prefetchStoryDetail(storyId: string, queryClient: QueryClient) {
  import("./StoryDetail.js").catch(() => undefined);
  return queryClient.prefetchQuery(publicStoryQuery(storyId));
}

export async function prefetchReaderChapter(
  storyId: string,
  chapterId: string,
  queryClient: QueryClient,
) {
  const detail = await queryClient
    .ensureQueryData(publicStoryQuery(storyId))
    .catch(() => null);
  if (!detail) return;
  await queryClient.prefetchQuery(
    publicChapterQuery(storyId, chapterId, detail.story.userId),
  );
}
