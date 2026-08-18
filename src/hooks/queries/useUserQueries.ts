import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { readingHistoryRepo } from "@/services/ReadingHistoryRepo";
import { profileRepo } from "@/services/ProfileRepo";

export function useWalletAddressQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.user.walletAddress(userId!),
    queryFn: async () => (await profileRepo.get(userId!))?.walletAddress || null,
    enabled: !!userId,
    staleTime: Infinity, // wallet address rarely changes
  });
}

export function useSetWalletAddress(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useCallback(
    (address: string | null) => {
      if (!userId) return;
      queryClient.setQueryData(queryKeys.user.walletAddress(userId), address);
    },
    [queryClient, userId],
  );
}

export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.user.publicProfile(userId!),
    queryFn: () => profileRepo.get(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useGuestbookPolicy(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.user.guestbookPolicy(userId!),
    queryFn: async () => (await profileRepo.get(userId!))?.guestbookPolicy || "everyone",
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Resolves an author's *current* username live from their public profile,
 * keyed by uid — so username changes propagate everywhere without rewriting
 * the denormalized copies stored on stories/posts/comments. Returns the stored
 * `fallback` while the profile query is in flight (or has no username), which
 * keeps names from flashing empty on first render.
 */
export function useAuthorUsername(
  userId: string | undefined,
  fallback?: string,
): string {
  const { data } = usePublicProfile(userId);
  return data?.username?.trim() || fallback?.trim() || "unknown";
}

/**
 * The batched form of {@link useAuthorUsername}, for lists. One request for
 * every author on screen rather than one per row — the same trade the hook
 * above makes, at the granularity a thread actually renders at.
 */
export function useProfileNames(
  userIds: readonly (string | undefined)[],
): Map<string, string> {
  const ids = [...new Set(userIds.filter(Boolean) as string[])].sort();
  const { data } = useQuery({
    queryKey: queryKeys.user.profileNames(ids),
    queryFn: async () => {
      const profiles = await profileRepo.getMany(ids);
      return new Map(
        [...profiles].map(([uid, profile]) => [uid, profile.username]),
      );
    },
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 5,
  });
  return data ?? new Map();
}

export function useRecentlyRead(userId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: queryKeys.user.recentlyRead(userId!),
    queryFn: () => readingHistoryRepo.getRecentlyRead(limit),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useClearReadingHistory(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => readingHistoryRepo.clearAllProgress(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.user.recentlyRead(userId!), []);
    },
  });
}
