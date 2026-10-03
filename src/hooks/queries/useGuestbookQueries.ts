import { infiniteQueryOptions, useInfiniteQuery } from "@tanstack/react-query";
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

export function useGuestbookEntries(
  ownerId: string | undefined,
  viewerId: string | null | undefined,
) {
  return useInfiniteQuery({
    ...guestbookEntriesQuery(ownerId ?? "", viewerId ?? null),
    // An unknown viewer means auth is still resolving. An explicit null is a
    // signed-out visitor and is safe to fetch anonymously.
    enabled: !!ownerId && viewerId !== undefined,
  });
}

export const guestbookEntriesQuery = (
  ownerId: string,
  viewerId: string | null,
) =>
  infiniteQueryOptions<
    EntryPage,
    Error,
    { pages: EntryPage[] },
    readonly ["guestbook", string, string | null],
    PageParam
  >({
    queryKey: [...queryKeys.guestbook.byOwner(ownerId), viewerId] as const,
    queryFn: ({ pageParam }) => guestbookRepo.listEntries(ownerId, pageParam),
    initialPageParam: undefined as PageParam,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1000 * 60 * 2,
  });

export type WallFilter = "all" | "following" | "mine";

export function useWallFeed(
  viewerId: string | null | undefined,
  filter: WallFilter,
) {
  return useInfiniteQuery({
    ...wallFeedQuery(viewerId ?? "", filter),
    enabled: !!viewerId,
  });
}

export const wallFeedQuery = (viewerId: string, filter: WallFilter) =>
  infiniteQueryOptions<
    EntryPage,
    Error,
    { pages: EntryPage[] },
    readonly ["guestbook", "wall", WallFilter, string],
    PageParam
  >({
    queryKey: ["guestbook", "wall", filter, viewerId] as const,
    queryFn: ({ pageParam }) => guestbookRepo.listWall(filter, pageParam),
    initialPageParam: undefined as PageParam,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1000 * 60 * 2,
  });
