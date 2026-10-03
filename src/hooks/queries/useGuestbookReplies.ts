import { useQuery } from "@tanstack/react-query";
import { guestbookRepo } from "@novelsync/story-data-client";
import { guestbookRepliesKey } from "@/lib/guestbookReplies";
import { useGuestbookMutations } from "./useGuestbookMutations";

export function useGuestbookReplies(
  ownerId: string,
  entryId: string,
  viewerId: string | null,
) {
  const mutations = useGuestbookMutations(viewerId);
  return useQuery({
    queryKey: guestbookRepliesKey(ownerId, entryId, viewerId),
    queryFn: async ({ signal }) => {
      // Always the first page: a refresh drops any older pages the reader had
      // opened rather than refetching an unbounded number of them.
      const thread = await guestbookRepo.listReplyPage(ownerId, entryId);
      // Correct every cached copy of the post once per read, not per mount.
      // A read cancelled by a reply write predates it and must not count.
      if (!signal.aborted) {
        mutations.replyCount(ownerId, entryId, thread.totalCount);
      }
      return thread;
    },
    staleTime: 1000 * 60 * 2,
  });
}
