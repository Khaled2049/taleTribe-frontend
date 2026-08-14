import { useMemo } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  useClaimFaucet,
  useTokenBalanceQuery,
} from "@/hooks/queries/useTokenQueries";
import { formatTokenAmount } from "@/lib/money";
import { TALE_DECIMALS, TALE_SYMBOL, type MinorUnits } from "@/types/IToken";

/**
 * The signed-in user's TALE balance, with a faucet claim, as an inline span
 * for surfaces that just want a compact balance readout. The Explore sidebar
 * uses the vertical `SidebarBalanceCard` instead, which shares these same
 * data hooks but not this layout.
 */
export const TokenBalanceBadge = () => {
  const { user } = useAuthContext();
  const userId = user?.uid;
  const { data, isLoading } = useTokenBalanceQuery(userId);
  const claimFaucet = useClaimFaucet(userId);

  const label = useMemo(() => {
    if (!data) return null;
    return formatTokenAmount({
      assetId: data.assetId,
      symbol: data.symbol ?? TALE_SYMBOL,
      decimals: data.decimals ?? TALE_DECIMALS,
      amount: data.balance as MinorUnits,
    });
  }, [data]);

  if (!userId) return null;

  const handleClaim = () => {
    claimFaucet.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(
          `Claimed ${formatTokenAmount({
            assetId: result.assetId,
            symbol: result.symbol ?? TALE_SYMBOL,
            decimals: result.decimals ?? TALE_DECIMALS,
            amount: result.granted,
          })}`,
        );
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to claim tokens",
        );
      },
    });
  };

  return (
    <div className="flex items-center gap-3">
      <span className="font-ui text-[10px] font-semibold tracking-[0.18em] uppercase text-neutral-400 dark:text-neutral-600">
        Balance
      </span>
      <span className="font-ui text-xs font-semibold tracking-wide text-dark-green dark:text-light-green tabular-nums">
        {isLoading || !label ? "—" : label}
      </span>
      <button
        type="button"
        onClick={handleClaim}
        disabled={claimFaucet.isPending}
        className="font-ui text-[10px] font-semibold tracking-[0.18em] uppercase text-neutral-500 dark:text-neutral-400 hover:text-dark-green dark:hover:text-light-green disabled:opacity-40 transition-colors"
      >
        {claimFaucet.isPending ? "Claiming…" : "Claim daily"}
      </button>
    </div>
  );
};

export default TokenBalanceBadge;
