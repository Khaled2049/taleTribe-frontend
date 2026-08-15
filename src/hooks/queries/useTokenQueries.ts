import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { tokenService } from "@/services/TokenService";
import type { ITokenBalance, MinorUnits } from "@/types/IToken";

/**
 * TALE balance, seeded by the API and kept live by a Firestore snapshot.
 *
 * The initial fetch goes through the endpoint on purpose: it materializes the
 * free starting grant, which a brand-new user has no document for yet. Once
 * that has run, `onSnapshot` on tokenAccounts/{accountId} pushes every later
 * change straight into the cache — so spending TALE on a competition updates
 * the header without a refetch or a manual invalidation.
 *
 * Follows the realtime-into-cache pattern documented in useCommentQueries.ts.
 */
export function useTokenBalanceQuery(userId: string | undefined) {
  const enabled = Boolean(userId);
  const queryKey = queryKeys.token.balance(userId ?? "anonymous");

  const query = useQuery({
    queryKey,
    queryFn: () => tokenService.getBalance(),
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  return query;
}

/** Claim the daily faucet and write the returned balance straight into cache. */
export function useClaimFaucet(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => tokenService.claimFaucet(),
    onSuccess: (result) => {
      if (!userId) return;
      queryClient.setQueryData<ITokenBalance>(
        queryKeys.token.balance(userId),
        result,
      );
    },
  });
}

export type { ITokenBalance, MinorUnits };
