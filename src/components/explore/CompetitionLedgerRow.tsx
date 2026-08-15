import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatCountdown } from "@/hooks/useCountdown";
import {
  getEntryFee,
  getHostName,
  getPrizeDisplay,
  hasJoinedWithoutSubmitting,
} from "@/lib/competitionListing";
import { formatTokenAmount } from "@/lib/money";
import {
  LEDGER_GRID,
  ROW_ACTION,
  actionBadgeProps,
  type RowActionKey,
} from "@/lib/competitionLedger";
import type { ICompetition } from "@/types/ICompetition";

/**
 * A row is a link and nothing else. Editing and cancelling live on the
 * competition's own page, where the phase rules that govern them are visible —
 * a bare "Cancel" in a list gives no hint that it refunds a prize pool.
 */
export interface CompetitionLedgerRowProps {
  competition: ICompetition;
  now: number;
}

/** Guards against "Closes in Closed" once the entry deadline has passed. */
const entrySubline = (
  countdown: ReturnType<typeof formatCountdown>,
  category: string,
): string =>
  countdown.isPast
    ? `Entries closed · ${category}`
    : `Closes in ${countdown.label} · ${category}`;

const LedgerDate = ({ date }: { date?: Date }) => {
  if (!date) return <span className="text-ns-ink-muted">—</span>;

  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString()}>
      <span className="block whitespace-nowrap">
        {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </span>
      <span className="block text-[10px] text-ns-ink-muted whitespace-nowrap mt-0.5">
        {date.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
    </time>
  );
};

function rowState(competition: ICompetition, now: number) {
  const countdown = formatCountdown(competition.deadline, now);
  const category = competition.category;

  if (competition.phase === "settled") {
    return {
      subline: `Results announced · ${category}`,
      urgent: false,
      dim: true,
      actionKey: "results" as RowActionKey,
    };
  }
  if (competition.phase === "settling") {
    return {
      subline: `Judging · ${category}`,
      urgent: false,
      dim: true,
      actionKey: "judging" as RowActionKey,
    };
  }
  if (competition.phase === "cancelled") {
    return {
      subline: `Cancelled · ${category}`,
      urgent: false,
      dim: true,
      actionKey: "cancelled" as RowActionKey,
    };
  }
  // Voting is still "active", so without this it would fall through to the
  // entry branch below and invite the reader to enter a competition whose
  // entries have already closed.
  if (competition.phase === "voting") {
    const voting = competition.votingDeadline
      ? formatCountdown(competition.votingDeadline, now)
      : null;
    return {
      subline:
        voting && !voting.isPast
          ? `Voting closes in ${voting.label} · ${category}`
          : `Voting open · ${category}`,
      urgent: voting?.isUrgent ?? false,
      dim: false,
      actionKey: "vote" as RowActionKey,
    };
  }
  if (competition.status === "completed") {
    // Legacy doc with no `phase` — fall back to the derived status only.
    return {
      subline: `Closed · ${category}`,
      urgent: false,
      dim: true,
      actionKey: "results" as RowActionKey,
    };
  }
  if (hasJoinedWithoutSubmitting(competition)) {
    return {
      subline: entrySubline(countdown, category),
      urgent: countdown.isUrgent,
      dim: false,
      actionKey: "continue" as RowActionKey,
    };
  }
  return {
    subline: entrySubline(countdown, category),
    urgent: countdown.isUrgent,
    dim: false,
    actionKey: (competition.status === "upcoming"
      ? "register"
      : "enter") as RowActionKey,
  };
}

export function CompetitionLedgerRow({
  competition,
  now,
}: CompetitionLedgerRowProps) {
  const prize = getPrizeDisplay(competition);
  const entryFee = getEntryFee(competition);
  const state = rowState(competition, now);
  const detailUrl = `/competitions/${competition.id}`;
  const entrants = `${competition.participants}${
    competition.maxParticipants ? ` / ${competition.maxParticipants}` : ""
  }`;

  const action = ROW_ACTION[state.actionKey];
  const badge = actionBadgeProps(action.tone);
  const joined = state.actionKey === "continue";

  const actionPill = (
    <Badge
      variant={badge.variant}
      className={cn("pointer-events-none", badge.className)}
    >
      {action.label}
    </Badge>
  );

  return (
    <div
      className={cn(
        "relative border-b border-ns-border py-[18px] px-1",
        "transition-colors duration-150 hover:bg-ns-surface-hover",
        state.dim && "opacity-[0.62]",
        joined && "bg-gradient-to-r from-ns-accent-subtle to-transparent",
      )}
    >
      <Link
        to={detailUrl}
        className="absolute inset-0 z-0"
        aria-label={competition.title}
      />

      {/* Desktop / tablet ledger row */}
      <div className={cn("hidden md:grid items-center gap-x-5", LEDGER_GRID)}>
        <div className="relative z-10 pointer-events-none min-w-0">
          <p className="font-heading text-2xl leading-[1.05] text-ns-ink truncate">
            {competition.title}
          </p>
          <p
            className={cn(
              "font-ui text-xs mt-1",
              state.urgent
                ? "font-semibold text-ns-accent"
                : "text-ns-ink-muted",
            )}
          >
            {state.subline}
          </p>
        </div>

        <div className="hidden xl:block relative z-10 pointer-events-none font-ui text-sm text-ns-ink-secondary truncate">
          {getHostName(competition)}
        </div>

        <div className="hidden xl:block relative z-10 pointer-events-none font-ui text-xs text-ns-ink-secondary tabular-nums">
          <LedgerDate date={competition.startDate} />
        </div>

        <div className="hidden xl:block relative z-10 pointer-events-none font-ui text-xs text-ns-ink-secondary tabular-nums">
          <LedgerDate date={competition.deadline} />
        </div>

        <div className="hidden xl:block relative z-10 pointer-events-none font-ui text-xs text-ns-ink-secondary tabular-nums">
          <LedgerDate date={competition.votingDeadline} />
        </div>

        <div className="relative z-10 pointer-events-none text-right font-ui text-sm">
          {entryFee ? (
            <span className="font-semibold text-ns-ink tabular-nums">
              {formatTokenAmount(entryFee)}
            </span>
          ) : (
            <span className="font-semibold text-ns-success">Free</span>
          )}
        </div>

        <div className="relative z-10 flex items-center justify-end gap-3">
          {actionPill}
        </div>
      </div>

      {/* Stacked card, narrow viewports */}
      <div className="md:hidden relative z-10 flex flex-col gap-2 pointer-events-none">
        <p className="font-heading text-2xl leading-[1.05] text-ns-ink">
          {competition.title}
        </p>
        <p
          className={cn(
            "font-ui text-xs",
            state.urgent ? "font-semibold text-ns-accent" : "text-ns-ink-muted",
          )}
        >
          {state.subline} · by {getHostName(competition)}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="font-heading text-2xl text-ns-gold-bright">
            {prize.amount}
          </span>
          <span className="font-ui text-xs text-ns-ink-secondary tabular-nums">
            {entrants} entered
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 font-ui text-xs">
          <span className="text-ns-ink-muted">Entry</span>
          {entryFee ? (
            <span className="font-semibold text-ns-ink tabular-nums">
              {formatTokenAmount(entryFee)}
            </span>
          ) : (
            <span className="font-semibold text-ns-success">Free</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2 border-t border-ns-border pt-3">
          <div>
            <p className="font-ui text-[9px] uppercase tracking-[0.12em] text-ns-ink-muted">
              Opens
            </p>
            <div className="font-ui text-[11px] text-ns-ink-secondary tabular-nums mt-1">
              <LedgerDate date={competition.startDate} />
            </div>
          </div>
          <div>
            <p className="font-ui text-[9px] uppercase tracking-[0.12em] text-ns-ink-muted">
              Entries close
            </p>
            <div className="font-ui text-[11px] text-ns-ink-secondary tabular-nums mt-1">
              <LedgerDate date={competition.deadline} />
            </div>
          </div>
          <div>
            <p className="font-ui text-[9px] uppercase tracking-[0.12em] text-ns-ink-muted">
              Voting closes
            </p>
            <div className="font-ui text-[11px] text-ns-ink-secondary tabular-nums mt-1">
              <LedgerDate date={competition.votingDeadline} />
            </div>
          </div>
        </div>
        <div className="flex items-center mt-1">{actionPill}</div>
      </div>
    </div>
  );
}

export default CompetitionLedgerRow;
