import {
  infiniteQueryOptions,
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { publicStoryRepo } from "@novelsync/story-data-client";
import { queryKeys } from "./queryKeys";

export const publishedStoriesQuery = (
  category: string,
  search = "",
  tag = "",
) =>
  infiniteQueryOptions({
    queryKey: queryKeys.stories.byCategory(category, search, tag),
    queryFn: ({ pageParam }) =>
      publicStoryRepo.getPublishedStories(
        pageParam,
        category === "all" ? undefined : category,
        search || undefined,
        { tag: tag || undefined },
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
export function usePublishedStories(category: string, search = "", tag = "") {
  return useInfiniteQuery({
    ...publishedStoriesQuery(category, search, tag),
    // Keep the previous term's results on screen while the next one loads, so
    // typing refines the grid instead of collapsing it to a spinner each time.
    placeholderData: keepPreviousData,
  });
}

/** An author's published stories, newest first — the first page only. */
export function useAuthorStories(authorId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.stories.byAuthor(authorId ?? ""),
    queryFn: () =>
      publicStoryRepo.getPublishedStories(null, undefined, undefined, {
        author: authorId,
      }),
    enabled: !!authorId && enabled,
    staleTime: 1000 * 60 * 5,
    select: (page) => page.stories,
  });
}
