import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { bookClubRepo } from "@/routes/BookClub/bookClubRepo";
import { IClub } from "@/types/IClub";

export function useBookClub(clubId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.bookClubs.detail(clubId!);
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey }); };
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

export function useBookClubs(enabled = true) {
  return useQuery<IClub[]>({
    queryKey: queryKeys.bookClubs.all(),
    queryFn: async () => {
      const clubs = await bookClubRepo.getBookClubs();
      return clubs ?? [];
    },
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}
