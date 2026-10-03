import { queryOptions, useQuery } from "@tanstack/react-query";
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
