import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import { queryKeys } from "./queryKeys";

export const ownerStoriesQuery = (uid: string) =>
  queryOptions({
    queryKey: queryKeys.user.stories(uid),
    queryFn: () => storyWorkspaceRepo.getUserStories(),
    staleTime: 1000 * 60 * 5,
  });

export function useOwnerStories(uid: string | undefined) {
  return useQuery({
    ...ownerStoriesQuery(uid ?? ""),
    enabled: !!uid,
  });
}

export const OWNER_STORY_PAGE_SIZE = 24;

export const ownerStoryPagesQuery = (uid: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.user.storyPages(uid),
    queryFn: ({ pageParam }) =>
      storyWorkspaceRepo.getUserStoriesPage(
        OWNER_STORY_PAGE_SIZE,
        pageParam || undefined,
      ),
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 1000 * 60 * 5,
  });

export function useOwnerStoryPages(uid: string | undefined) {
  return useInfiniteQuery({
    ...ownerStoryPagesQuery(uid ?? ""),
    enabled: !!uid,
  });
}
