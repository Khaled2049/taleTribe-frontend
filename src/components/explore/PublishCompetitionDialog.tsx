import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMinorUnits } from "@/lib/money";
import { TALE_SYMBOL, type MinorUnits } from "@/types/IToken";

export interface PublishCompetitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prize about to be escrowed, in minor units. */
  prizeAmount: MinorUnits;
  /** Entry fee, or null when the competition is free to enter. */
  entryFee: MinorUnits | null;
  /** The host's spendable balance. `undefined` while it is still loading. */
  balance: MinorUnits | undefined;
  /** Whether publishing opens it now or schedules it for the start date. */
  opensImmediately: boolean;
  onConfirm: () => void;
  isPublishing: boolean;
}

const tale = (amount: MinorUnits) => `${formatMinorUnits(amount)} ${TALE_SYMBOL}`;

/**
 * Confirmation for publishing. This is the only irreversible step in the host
 * flow: it moves the prize into escrow and freezes the terms, and the only way
 * back is cancelling, which is public.
 *
 * The disabled state is a courtesy, not a control — publishCompetition re-checks
 * the balance and answers 402, leaving the competition a draft.
 */
export function PublishCompetitionDialog({
  open,
  onOpenChange,
  prizeAmount,
  entryFee,
  balance,
  opensImmediately,
  onConfirm,
  isPublishing,
}: PublishCompetitionDialogProps) {
  const short = balance !== undefined && BigInt(balance) < BigInt(prizeAmount);
  const after =
    balance !== undefined && !short
      ? ((BigInt(balance) - BigInt(prizeAmount)).toString() as MinorUnits)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-3xl font-light">
            Publish this competition?
          </DialogTitle>
        </DialogHeader>

        <p className="font-body text-[15px] leading-relaxed text-ns-ink-secondary">
          {opensImmediately
            ? "It goes live immediately and starts accepting entries."
            : "It becomes public now and opens for entries on the start date."}{" "}
          The prize moves into escrow and is held there until the competition
          settles.
        </p>

        <dl className="mt-2 divide-y divide-ns-border border-y border-ns-border">
          <div className="flex items-center justify-between py-3">
            <dt className="font-ui text-[13px] text-ns-ink-muted">
              Prize into escrow
            </dt>
            <dd className="font-ui text-[13px] font-semibold text-ns-ink tabular-nums">
              {tale(prizeAmount)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="font-ui text-[13px] text-ns-ink-muted">
              Your balance
            </dt>
            <dd className="font-ui text-[13px] font-semibold text-ns-ink tabular-nums">
              {balance === undefined ? "…" : tale(balance)}
            </dd>
          </div>
          {after !== null && (
            <div className="flex items-center justify-between py-3">
              <dt className="font-ui text-[13px] text-ns-ink-muted">
                Balance after
              </dt>
              <dd className="font-ui text-[13px] font-semibold text-ns-ink-secondary tabular-nums">
                {tale(after)}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between py-3">
            <dt className="font-ui text-[13px] text-ns-ink-muted">Entry fee</dt>
            <dd className="font-ui text-[13px] font-semibold tabular-nums">
              {entryFee ? (
                <span className="text-ns-ink">{tale(entryFee)}</span>
              ) : (
                <span className="text-ns-success">Free</span>
              )}
            </dd>
          </div>
        </dl>

        <p className="font-ui text-[11px] leading-relaxed text-ns-ink-muted">
          The prize and the entry fee cannot be changed after this. Cancelling
          later refunds the prize to you and every entry fee to whoever paid it.
        </p>

        {short && (
          <p className="font-ui text-[13px] text-ns-destructive">
            You don't have enough {TALE_SYMBOL} to fund this prize. The
            competition stays a draft.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPublishing}
          >
            Keep editing
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPublishing || short || balance === undefined}
            className="bg-ns-ink text-ns-bg hover:opacity-90"
          >
            {isPublishing ? "Publishing…" : `Publish · ${tale(prizeAmount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PublishCompetitionDialog;
