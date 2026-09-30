import {
  infiniteQueryOptions,
  keepPreviousData,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { publicStoryRepo } from "@novelsync/story-data-client";
import { queryKeys } from "./queryKeys";

export const publishedStoriesQuery = (category: string, search = "") =>
  infiniteQueryOptions({
    queryKey: queryKeys.stories.byCategory(category, search),
    queryFn: ({ pageParam }) =>
      publicStoryRepo.getPublishedStories(
        pageParam,
        category === "all" ? undefined : category,
        search || undefined,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    staleTime: 1000 * 60 * 5,
  });

/**
 * Cursor-paginated published stories for the discovery grid.
 * Pages are fetched on demand (infinite scroll); each page carries the
 * API cursor for the next fetch. `getNextPageParam` returns undefined
 * once the repo reports a null cursor, which sets `hasNextPage` to false.
 *
 * `search` matches server-side against title and author name, so it finds
 * stories that infinite scroll has not reached yet. It belongs to the query
 * key, which is what keeps it cheap: a repeated or retyped term is served
 * from cache for the full `staleTime` rather than re-querying. Callers are
 * expected to pass a debounced value — this hook fires one request per
 * distinct term it is handed.
 */
export function usePublishedStories(category: string, search = "") {
  return useInfiniteQuery({
    ...publishedStoriesQuery(category, search),
    // Keep the previous term's results on screen while the next one loads, so
    // typing refines the grid instead of collapsing it to a spinner each time.
    placeholderData: keepPreviousData,
  });
}
