import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEntryFee } from "@/lib/competitionListing";
import { formatTokenAmount } from "@/lib/money";
import type { ICompetition } from "@/types/ICompetition";
import type { ICompetitionSubmission } from "@/types/ICompetitionSubmission";

export interface CompetitionEnteredCardProps {
  competition: ICompetition;
  entry: ICompetitionSubmission;
  /** Withdraws the current entry, then reopens the picker — there's no server-side edit-in-place. */
  onEdit: () => void;
  onReadBrief: () => void;
  busy?: boolean;
}

export function CompetitionEnteredCard({
  competition,
  entry,
  onEdit,
  onReadBrief,
  busy = false,
}: CompetitionEnteredCardProps) {
  const editable = competition.phase === "open" || !competition.phase;
  const entryFee = getEntryFee(competition);

  return (
    <div className="rounded-[14px] border border-ns-border bg-ns-elevated overflow-hidden">
      <div className="flex items-center gap-2.5 bg-ns-accent-subtle px-[18px] py-3.5 border-b border-ns-border">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-ns-accent shrink-0">
          <Check className="w-3 h-3 text-white" />
        </span>
        <span className="font-ui text-[13px] font-semibold text-ns-accent">
          Submitted
        </span>
      </div>

      <div className="p-[22px] flex flex-col gap-4">
        <div>
          <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted mb-1.5">
            Your entry
          </p>
          <p className="font-body italic text-base text-ns-ink">
            {entry.storyTitle}
          </p>
        </div>

        <div className="h-px bg-ns-border" />

        <div className="flex items-center justify-between">
          <span className="font-ui text-[13px] text-ns-ink-muted">
            You can edit until
          </span>
          <span className="font-ui text-[13px] font-semibold text-ns-accent">
            {competition.deadline.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        {entryFee && (
          <div className="flex items-center justify-between">
            <span className="font-ui text-[13px] text-ns-ink-muted">
              Entry fee paid
            </span>
            <span className="font-ui text-[13px] font-semibold text-ns-ink tabular-nums">
              {formatTokenAmount(entryFee)}
            </span>
          </div>
        )}

        {entryFee && editable && (
          <p className="font-ui text-[11px] leading-relaxed text-ns-ink-muted">
            Editing withdraws your entry first, which refunds the fee — you'll
            pay it again when you resubmit.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onEdit}
            disabled={!editable || busy}
            title={!editable ? "Editing closes once voting starts" : undefined}
          >
            Edit entry
          </Button>
          <Button
            className="flex-1 bg-ns-ink text-ns-bg hover:opacity-90"
            onClick={onReadBrief}
          >
            Read the brief
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CompetitionEnteredCard;
