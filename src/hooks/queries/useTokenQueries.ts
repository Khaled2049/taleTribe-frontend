import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { onSnapshot } from "firebase/firestore";
import { queryKeys } from "./queryKeys";
import { tokenService } from "@/services/TokenService";
import { isMinorUnits } from "@/lib/money";
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
  const queryClient = useQueryClient();
  const enabled = Boolean(userId);
  const queryKey = queryKeys.token.balance(userId ?? "anonymous");

  const query = useQuery({
    queryKey,
    queryFn: () => tokenService.getBalance(),
    enabled,
    // The snapshot below is the source of truth once seeded.
    staleTime: Infinity,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onSnapshot(
      tokenService.getAccountRef(userId),
      (snapshot) => {
        const raw = snapshot.data()?.balance;
        if (!isMinorUnits(raw)) return;

        queryClient.setQueryData<ITokenBalance>(queryKey, (previous) => ({
          ...(previous ?? tokenService.emptyBalance(userId)),
          balance: raw,
        }));
      },
      (error) => {
        // A missing account document before the first grant is expected, and
        // the seeding query already covers it — don't surface it as an error.
        console.error("Token balance subscription failed", error);
      },
    );

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, queryClient]);

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
