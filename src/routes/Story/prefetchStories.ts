import type { QueryClient } from "@tanstack/react-query";
import { appQueryClient } from "@/lib/queryClient";
import { publishedStoriesQuery } from "@/hooks/queries/publishedStories";

export function prefetchStoriesPage(queryClient: QueryClient = appQueryClient) {
  import("./AllStories").catch(() => undefined);
  return queryClient.prefetchInfiniteQuery(publishedStoriesQuery("all"));
}
