import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { storySocialRepo } from "@novelsync/story-data-client";
import { Comment } from "@novelsync/story-data-client";

export function useComments(storyId: string | undefined) {
  return useQuery<Comment[]>({
    queryKey: queryKeys.comments.byStory(storyId!),
    queryFn: () => storySocialRepo.getComments(storyId!),
    enabled: !!storyId,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });
}

/**
 * Writes into the cached thread so a comment the viewer just posted, edited,
 * liked or deleted appears immediately. The thread is otherwise only refreshed
 * on the 30s stale window or a window focus, so without this the viewer waits
 * on a full re-fetch to see their own action.
 */
export function useCommentCache(storyId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.comments.byStory(storyId!);

  const upsert = useCallback(
    (comment: Comment) => {
      if (!storyId) return;
      queryClient.setQueryData<Comment[]>(queryKey, (current) => {
        const rest = (current ?? []).filter((c) => c.id !== comment.id);
        return [...rest, comment].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );
      });
    },
    [queryClient, queryKey, storyId],
  );

  const remove = useCallback(
    (commentId: string) => {
      if (!storyId) return;
      queryClient.setQueryData<Comment[]>(queryKey, (current) =>
        // Replies are cascaded server-side, so they go here too.
        (current ?? []).filter(
          (c) => c.id !== commentId && c.parentId !== commentId,
        ),
      );
    },
    [queryClient, queryKey, storyId],
  );

  const invalidate = useCallback(() => {
    if (!storyId) return Promise.resolve();
    return queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey, storyId]);

  return { upsert, remove, invalidate };
}
