import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { creditService, CreditBalance } from "@/cloudFunctions/credits";

export function useAiCreditsQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.user.aiCredits(userId!),
    queryFn: () => creditService.getBalance(),
    enabled: !!userId,
    // Balance updates on demand only — the manual refresh button (refetch) or a
    // purchase writing the cache. staleTime: Infinity + refetchOnMount: false
    // mean it fetches once to seed, then never background-refetches on
    // remount/focus/reconnect, so opening the editor doesn't hit the endpoint.
    staleTime: Infinity,
    refetchOnMount: false,
    // Override the global retry: 1 — a transient hiccup in the
    // Function -> agents -> creditProxy chain would otherwise silently fire a
    // second invocation. The manual refresh button already covers retrying.
    retry: 0,
  });
}

export function usePurchaseCredits(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credits: number) => creditService.purchaseCredits(credits),
    onSuccess: (data: CreditBalance) => {
      if (userId) {
        // The purchase response already carries the new balance — write it
        // straight into the cache so the display updates without a refetch.
        queryClient.setQueryData(queryKeys.user.aiCredits(userId), data);
      }
    },
  });
}
