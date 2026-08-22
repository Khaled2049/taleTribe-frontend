import { useCallback } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { guestbookRepo } from "@novelsync/story-data-client";
import { IGuestbookEntry } from "@novelsync/story-data-client";

type PageParam = string | undefined;

type EntryPage = {
  entries: IGuestbookEntry[];
  nextCursor?: string;
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
    queryKey: [
      ...queryKeys.guestbook.byOwner(ownerId ?? ""),
      viewerId,
    ] as const,
    enabled: !!ownerId,
    queryFn: async ({ pageParam }) => {
      return guestbookRepo.listEntries(ownerId!, pageParam);
    },
    initialPageParam: undefined as PageParam,
    getNextPageParam: (lastPage) =>
      lastPage.entries.length < ENTRIES_PER_PAGE
        ? undefined
        : lastPage.nextCursor,
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
            pages: [{ entries: [entry] }],
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
