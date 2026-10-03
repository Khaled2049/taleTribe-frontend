import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { bookClubRepo } from "@/routes/BookClub/bookClubRepo";
import { IClub, IReadingProgress } from "@/types/IClub";

export function useBookClub(clubId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.bookClubs.detail(clubId!);
  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey });
      // The list is not on screen here, so it is only marked stale and
      // refetches when the reader goes back to it.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bookClubs.list(),
        refetchType: "none",
      });
    };
    window.addEventListener("book-club-changed", refresh);
    return () => window.removeEventListener("book-club-changed", refresh);
  }, [queryClient, queryKey]);
  return useQuery<IClub | null>({
    queryKey,
    queryFn: async () => (await bookClubRepo.getBookClub(clubId!)) ?? null,
    enabled: !!clubId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
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
  return useQuery<IClub[]>({
    queryKey: queryKeys.bookClubs.list(),
    queryFn: () => bookClubRepo.getBookClubs(),
  });
}

/**
 * Applies the result of a write the list page just made to the cached list,
 * and marks that club's cached detail stale so it is not shown as it was.
 */
export function useBookClubListCache() {
  const queryClient = useQueryClient();
  return useCallback(
    async (clubId: string, update: (clubs: IClub[]) => IClub[]) => {
      const queryKey = queryKeys.bookClubs.list();
      if (queryClient.getQueryData(queryKey) !== undefined) {
        // A list read that started before the write would land after this
        // patch and put the old rows back.
        await queryClient.cancelQueries({ queryKey });
        queryClient.setQueryData<IClub[]>(queryKey, (clubs) =>
          clubs ? update(clubs) : clubs,
        );
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bookClubs.detail(clubId),
      });
    },
    [queryClient],
  );
}
