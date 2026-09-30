import type { QueryClient } from "@tanstack/react-query";
import { appQueryClient } from "@/lib/queryClient";
import { publicStoryQuery } from "@/hooks/queries/publicStory";

export function prefetchStoryDetail(
  storyId: string,
  queryClient: QueryClient = appQueryClient,
) {
  import("./StoryDetail").catch(() => undefined);
  return queryClient.prefetchQuery(publicStoryQuery(storyId));
}
