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
 * $TALE balance card, rendered on the Profile page (owner settings). Shares
 * data hooks and formatting with TokenBalanceBadge (that one stays as the
 * inline span used elsewhere) but needs its own layout, so it isn't reused
 * directly.
 */
export function SidebarBalanceCard() {
  const { user } = useAuthContext();
  const userId = user?.uid;
  const { data, isLoading } = useTokenBalanceQuery(userId);
  const claimFaucet = useClaimFaucet(userId);

  const amount = useMemo(() => {
    if (!data) return null;
    return formatTokenAmount({
      assetId: data.assetId,
      symbol: data.symbol ?? TALE_SYMBOL,
      decimals: data.decimals ?? TALE_DECIMALS,
      amount: data.balance as MinorUnits,
    });
  }, [data]);

  if (!userId) return null;

  const [wholeAmount, symbol] = amount
    ? amount.split(" ")
    : [null, TALE_SYMBOL];

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
    <div className="flex flex-col gap-2 rounded-ns-lg border border-ns-border bg-ns-elevated p-4">
      <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-ns-ink-muted">
        Your balance
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-heading text-[30px] leading-none text-ns-ink tabular-nums">
          {isLoading || !wholeAmount ? "—" : wholeAmount}
        </span>
        <span className="font-ui text-sm font-semibold text-ns-gold-bright">
          {symbol}
        </span>
      </div>
      <button
        type="button"
        onClick={handleClaim}
        disabled={claimFaucet.isPending}
        className="self-start font-ui text-xs font-semibold text-ns-accent hover:text-ns-accent-hover disabled:opacity-40 transition-colors"
      >
        {claimFaucet.isPending ? "Claiming…" : "Claim daily"}
      </button>
    </div>
  );
}

export default SidebarBalanceCard;
