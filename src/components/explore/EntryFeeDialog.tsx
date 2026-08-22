import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMinorUnits, formatTokenAmount } from "@/lib/money";
import { getEntryFeeLabel } from "@/lib/competitionListing";
import {
  TALE_SYMBOL,
  type ITokenAmount,
  type MinorUnits,
} from "@/types/IToken";
import type { ICompetition } from "@/types/ICompetition";

export interface EntryFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: ICompetition;
  fee: ITokenAmount;
  /** The viewer's spendable balance. `undefined` while it is still loading. */
  balance: MinorUnits | undefined;
  onConfirm: () => void;
  isSubmitting: boolean;
}

/**
 * Confirmation for a paid entry. The balance is shown because the alternative
 * is discovering a shortfall by having the submission fail.
 *
 * The disabled state is a courtesy, not a control — submitToCompetition
 * re-checks and returns 402, and this cannot see a spend in another tab.
 */
export function EntryFeeDialog({
  open,
  onOpenChange,
  competition,
  fee,
  balance,
  onConfirm,
  isSubmitting,
}: EntryFeeDialogProps) {
  const short = balance !== undefined && BigInt(balance) < BigInt(fee.amount);
  const after =
    balance !== undefined && !short
      ? (BigInt(balance) - BigInt(fee.amount)).toString()
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-3xl font-light">
            Enter for {getEntryFeeLabel(competition)}
          </DialogTitle>
        </DialogHeader>

        <p className="font-body text-[15px] leading-relaxed text-ns-ink-secondary">
          Your fee is held in escrow until the competition settles. Withdraw
          your entry before submissions close and you get it back in full — as
          you also would if the host cancels, or if nobody votes.
        </p>

        <dl className="mt-2 divide-y divide-ns-border border-y border-ns-border">
          <div className="flex items-center justify-between py-3">
            <dt className="font-ui text-[13px] text-ns-ink-muted">Entry fee</dt>
            <dd className="font-ui text-[13px] font-semibold text-ns-ink tabular-nums">
              {formatTokenAmount(fee)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="font-ui text-[13px] text-ns-ink-muted">
              Your balance
            </dt>
            <dd className="font-ui text-[13px] font-semibold text-ns-ink tabular-nums">
              {balance === undefined
                ? "…"
                : `${formatMinorUnits(balance)} ${TALE_SYMBOL}`}
            </dd>
          </div>
          {after !== null && (
            <div className="flex items-center justify-between py-3">
              <dt className="font-ui text-[13px] text-ns-ink-muted">
                Balance after
              </dt>
              <dd className="font-ui text-[13px] font-semibold text-ns-ink-secondary tabular-nums">
                {formatMinorUnits(after as MinorUnits)} {TALE_SYMBOL}
              </dd>
            </div>
          )}
        </dl>

        {short && (
          <p className="font-ui text-[13px] text-ns-destructive">
            You don't have enough {TALE_SYMBOL} to enter this competition.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting || short || balance === undefined}
            className="bg-ns-ink text-ns-bg hover:opacity-90"
          >
            {isSubmitting
              ? "Entering…"
              : `Pay ${formatTokenAmount(fee)} & enter`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EntryFeeDialog;
