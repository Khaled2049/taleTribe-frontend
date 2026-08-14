import { formatCountdown } from "@/hooks/useCountdown";
import type { ICompetition } from "@/types/ICompetition";

export interface CompetitionCountdownProps {
  competition: ICompetition;
  now: number;
}

export interface CountdownTileProps {
  value: number;
  unit: string;
  accent?: boolean;
}

/** Exported so the "how it works" explainer shows the same clock as the product. */
export function CountdownTile({ value, unit, accent }: CountdownTileProps) {
  return (
    <div className="flex-1 rounded-ns bg-ns-surface py-3 text-center">
      <p
        className={`font-heading text-[32px] leading-none tabular-nums ${accent ? "text-ns-accent" : "text-ns-ink"}`}
      >
        {value}
      </p>
      <p className="font-ui text-[10px] uppercase tracking-[0.14em] text-ns-ink-muted mt-1">
        {unit}
      </p>
    </div>
  );
}

/**
 * Time left to enter, as day/hour/minute tiles.
 *
 * Renders nothing once the entry deadline has passed. It used to fall back to
 * a "Status" panel showing the phase label, which only repeated the hero's
 * eyebrow — so on a competition in voting, settling, settled or cancelled the
 * card carried no information the reader didn't already have above it. The
 * dates it would have anchored are still in CompetitionKeyDatesCard.
 *
 * The tiles drop to hours/minutes/seconds inside the last day, which is why
 * this takes the shared `now` tick instead of owning an interval — see useNow.
 */
export function CompetitionCountdown({
  competition,
  now,
}: CompetitionCountdownProps) {
  const countdown = formatCountdown(competition.deadline, now);

  if (countdown.isPast) return null;

  return (
    <div className="h-full rounded-[14px] border border-ns-border bg-ns-elevated p-[22px]">
      <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted mb-3">
        Closes in
      </p>
      <div className="flex gap-2">
        {countdown.days > 0 ? (
          <>
            <CountdownTile value={countdown.days} unit="days" />
            <CountdownTile value={countdown.hours} unit="hrs" />
            <CountdownTile value={countdown.minutes} unit="min" accent />
          </>
        ) : (
          <>
            <CountdownTile value={countdown.hours} unit="hrs" />
            <CountdownTile value={countdown.minutes} unit="min" />
            <CountdownTile value={countdown.seconds} unit="sec" accent />
          </>
        )}
      </div>
    </div>
  );
}

export default CompetitionCountdown;
