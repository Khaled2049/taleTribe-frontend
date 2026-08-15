import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { storySocialRepo } from "@/services/StorySocialRepo";
import { Comment } from "@/types/IComment";

export function useComments(storyId: string | undefined, chapterId: string | undefined) {
  return useQuery<Comment[]>({
    queryKey: queryKeys.comments.byChapter(storyId!, chapterId!),
    queryFn: () => storySocialRepo.getComments(storyId!, chapterId!),
    enabled: !!storyId && !!chapterId,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });
}
