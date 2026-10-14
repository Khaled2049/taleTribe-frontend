import type { QueryClient } from "@tanstack/react-query";
import { publishedStoriesQuery } from "../../hooks/queries/publishedStories.js";

export function prefetchStoriesPage(queryClient: QueryClient) {
  import("./AllStories.js").catch(() => undefined);
  return queryClient.prefetchInfiniteQuery(publishedStoriesQuery("all"));
}
