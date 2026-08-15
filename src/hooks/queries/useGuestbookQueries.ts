import { useCallback } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { queryKeys } from "./queryKeys";
import { guestbookService } from "@/services/GuestbookService";
import { guestbookVoteService } from "@/services/GuestbookVoteService";
import { IGuestbookEntry } from "@/types/IGuestbookEntry";

type PageParam = QueryDocumentSnapshot<DocumentData> | undefined;

type EntryPage = {
  entries: IGuestbookEntry[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
};

type CachedPages = { pages: EntryPage[]; pageParams: PageParam[] };

const ENTRIES_PER_PAGE = 10;

export function useGuestbookEntries(
  ownerId: string | undefined,
  viewerId: string | null | undefined,
) {
  return useInfiniteQuery<
    EntryPage,
    Error,
    { pages: EntryPage[] },
    readonly unknown[],
    PageParam
  >({
    queryKey: [...queryKeys.guestbook.byOwner(ownerId ?? ""), viewerId] as const,
    enabled: !!ownerId,
    queryFn: async ({ pageParam }) => {
      const result = await guestbookService.listEntries(
        ownerId!,
        ENTRIES_PER_PAGE,
        pageParam,
      );

      if (viewerId && result.entries.length > 0) {
        const userVotes = await guestbookVoteService.getUserVotesForEntries(
          ownerId!,
          result.entries.map((e) => e.id),
          viewerId,
        );
        result.entries = result.entries.map((entry) => ({
          ...entry,
          userVote: userVotes.get(entry.id) ?? null,
        }));
      }

      return result;
    },
    initialPageParam: undefined as PageParam,
    getNextPageParam: (lastPage) =>
      lastPage.entries.length < ENTRIES_PER_PAGE
        ? undefined
        : (lastPage.lastDoc ?? undefined),
  });
}

/** Remove an entry from the infinite query cache without refetching. */
export function useRemoveEntryFromCache(
  ownerId: string | undefined,
  viewerId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useCallback(
    (entryId: string) => {
      const queryKey = [
        ...queryKeys.guestbook.byOwner(ownerId ?? ""),
        viewerId,
      ] as const;
      queryClient.setQueryData<CachedPages>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            entries: page.entries.filter((e) => e.id !== entryId),
          })),
        };
      });
    },
    [queryClient, ownerId, viewerId],
  );
}

/** Add an entry optimistically to the top of the first page. */
export function useAddEntryToCache(
  ownerId: string | undefined,
  viewerId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  return useCallback(
    (entry: IGuestbookEntry) => {
      const queryKey = [
        ...queryKeys.guestbook.byOwner(ownerId ?? ""),
        viewerId,
      ] as const;
      queryClient.setQueryData<CachedPages>(queryKey, (old) => {
        if (!old || old.pages.length === 0) {
          return {
            pages: [{ entries: [entry], lastDoc: null }],
            pageParams: [undefined],
          };
        }
        const [firstPage, ...restPages] = old.pages;
        return {
          ...old,
          pages: [
            { ...firstPage, entries: [entry, ...firstPage.entries] },
            ...restPages,
          ],
        };
      });
    },
    [queryClient, ownerId, viewerId],
  );
}
