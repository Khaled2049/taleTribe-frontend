import { useCallback } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { guestbookRepo } from "@novelsync/story-data-client";
import { IGuestbookEntry } from "@novelsync/story-data-client";

type PageParam = string | undefined;

type EntryPage = {
  entries: IGuestbookEntry[];
  nextCursor?: string;
  /** Only present on the classic single-owner wall (useGuestbookEntries) — the Wall's combined feed has no single "owner" to count against. */
  totalCount?: number;
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

export type WallFilter = "all" | "following" | "mine";

export function useWallFeed(
  viewerId: string | null | undefined,
  filter: WallFilter,
) {
  return useInfiniteQuery<
    EntryPage,
    Error,
    { pages: EntryPage[] },
    readonly unknown[],
    PageParam
  >({
    queryKey: [...queryKeys.guestbook.wall(filter), viewerId] as const,
    enabled: !!viewerId,
    queryFn: async ({ pageParam }) => {
      return guestbookRepo.listWall(filter, pageParam);
    },
    initialPageParam: undefined as PageParam,
    getNextPageParam: (lastPage) =>
      lastPage.entries.length < ENTRIES_PER_PAGE
        ? undefined
        : lastPage.nextCursor,
  });
}

/** Remove an entry from the wall feed cache without refetching. */
export function useRemoveWallEntryFromCache(
  viewerId: string | null | undefined,
  filter: WallFilter,
) {
  const queryClient = useQueryClient();

  return useCallback(
    (entryId: string) => {
      const queryKey = [...queryKeys.guestbook.wall(filter), viewerId] as const;
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
    [queryClient, viewerId, filter],
  );
}

/** Add an entry optimistically to the top of the wall feed cache. */
export function useAddWallEntryToCache(
  viewerId: string | null | undefined,
  filter: WallFilter,
) {
  const queryClient = useQueryClient();

  return useCallback(
    (entry: IGuestbookEntry) => {
      const queryKey = [...queryKeys.guestbook.wall(filter), viewerId] as const;
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
    [queryClient, viewerId, filter],
  );
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
        let removed = 0;
        const pages = old.pages.map((page) => {
          const entries = page.entries.filter((e) => e.id !== entryId);
          removed += page.entries.length - entries.length;
          return { ...page, entries };
        });
        // totalCount only lives on the first page (see useGuestbookEntries) —
        // deleting/rolling back an entry, wherever it lived, shrinks the same
        // whole-wall count the tab row reads from page 0.
        if (removed > 0 && pages[0]?.totalCount !== undefined) {
          pages[0] = {
            ...pages[0],
            totalCount: Math.max(0, pages[0].totalCount - removed),
          };
        }
        return { ...old, pages };
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
            pages: [{ entries: [entry], totalCount: 1 }],
            pageParams: [undefined],
          };
        }
        const [firstPage, ...restPages] = old.pages;
        return {
          ...old,
          pages: [
            {
              ...firstPage,
              entries: [entry, ...firstPage.entries],
              totalCount:
                firstPage.totalCount !== undefined
                  ? firstPage.totalCount + 1
                  : firstPage.totalCount,
            },
            ...restPages,
          ],
        };
      });
    },
    [queryClient, ownerId, viewerId],
  );
}
