import { useCallback } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { bookClubRepo } from "@/routes/BookClub/bookClubRepo";
import { IClub, IClubSummary, IReadingProgress } from "@/types/IClub";
import { withMembership } from "@/lib/bookClubList";

// Other members' changes arrive only by refetch — story-data has no realtime
// channel — so this stays short-lived and refreshes on focus. The viewer's own
// writes do not wait for that: see useBookClubCache.
export const bookClubQuery = (clubId: string) =>
  queryOptions<IClub | null>({
    queryKey: queryKeys.bookClubs.detail(clubId),
    queryFn: async () => (await bookClubRepo.getBookClub(clubId)) ?? null,
    staleTime: 15_000,
  });

export function useBookClub(clubId: string | undefined) {
  return useQuery({
    ...bookClubQuery(clubId ?? ""),
    enabled: !!clubId,
    refetchOnWindowFocus: true,
  });
}

/**
 * Writes the outcome of a confirmed mutation into the cached club, in place of
 * refetching it. Pass the club the server returned, or a function that applies
 * the change when the server returned only the new entity or nothing.
 */
export function useBookClubCache(clubId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    async (next: IClub | ((club: IClub) => IClub)) => {
      const queryKey = queryKeys.bookClubs.detail(clubId);
      // `exact` keeps this off the progress query, which shares the prefix.
      // A club read that started before the write would otherwise land after
      // this and put the old club back.
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<IClub | null>(queryKey, (club) => {
        if (typeof next !== "function") return next;
        return club ? next(club) : club;
      });
      // The list and the viewer's memberships are not on screen here, so they
      // are only marked stale and refetch when the reader goes back to them.
      for (const stale of [
        queryKeys.bookClubs.list(),
        queryKeys.bookClubs.mine(),
      ]) {
        void queryClient.invalidateQueries({
          queryKey: stale,
          refetchType: "none",
        });
      }
    },
    [queryClient, clubId],
  );
}

// Member progress is polled rather than pushed — story-data has no realtime
// channel, so another member's chapter change lands on the next interval.
export function useClubProgress(clubId: string | undefined, enabled = true) {
  return useQuery<IReadingProgress[]>({
    queryKey: queryKeys.bookClubs.progress(clubId!),
    queryFn: () => bookClubRepo.getMemberProgress(clubId!),
    enabled: !!clubId && enabled,
    refetchInterval: 15_000,
    staleTime: 15_000,
  });
}

export function useBookClubs() {
  return useQuery<IClubSummary[]>({
    queryKey: queryKeys.bookClubs.list(),
    queryFn: () => bookClubRepo.getBookClubs(),
  });
}

/**
 * The ids of the clubs the viewer belongs to. The list itself is the same for
 * every caller, so membership is read separately. The cache is cleared when
 * the signed-in user changes, which is why the key carries no uid.
 */
export function useMyBookClubIds(uid: string | null) {
  return useQuery<string[]>({
    queryKey: queryKeys.bookClubs.mine(),
    queryFn: () => bookClubRepo.getMyBookClubIds(),
    enabled: !!uid,
  });
}

/**
 * Applies the result of a write the list page just made to the cached list,
 * and marks that club's cached detail stale so it is not shown as it was.
 * `joined` also records the viewer joining or leaving that club.
 */
export function useBookClubListCache() {
  const queryClient = useQueryClient();
  return useCallback(
    async (
      clubId: string,
      update: (clubs: IClubSummary[]) => IClubSummary[],
      joined?: boolean,
    ) => {
      const queryKey = queryKeys.bookClubs.list();
      if (queryClient.getQueryData(queryKey) !== undefined) {
        // A list read that started before the write would land after this
        // patch and put the old rows back.
        await queryClient.cancelQueries({ queryKey });
        queryClient.setQueryData<IClubSummary[]>(queryKey, (clubs) =>
          clubs ? update(clubs) : clubs,
        );
      }
      if (joined !== undefined) {
        const mine = queryKeys.bookClubs.mine();
        await queryClient.cancelQueries({ queryKey: mine });
        queryClient.setQueryData<string[]>(mine, (ids) =>
          ids ? withMembership(ids, clubId, joined) : ids,
        );
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bookClubs.detail(clubId),
      });
    },
    [queryClient],
  );
}
