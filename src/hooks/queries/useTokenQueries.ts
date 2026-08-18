import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { tokenService } from "@/services/TokenService";
import type { ITokenBalance, MinorUnits } from "@/types/IToken";

/**
 * TALE balance, polled from story-data.
 *
 * The fetch materializes the free starting grant, which a brand-new user has
 * no row for yet. Firestore's onSnapshot backed this before the cutover; the
 * balance now lives in PostgreSQL, so a mutation that moves TALE must write
 * the returned balance into the cache (as useClaimFaucet does) or the header
 * lags by up to the poll interval.
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
