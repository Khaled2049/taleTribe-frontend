import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import SponsorBadge from "./SponsorBadge";
import SponsorSection from "./SponsorSection";
import { formatCountdown } from "@/hooks/useCountdown";
import {
  getEntryFee,
  getEntryFeeLabel,
  getHostName,
  getPrizeDisplay,
} from "@/lib/competitionListing";
import type { ICompetition } from "@/types/ICompetition";

export interface CompetitionDetailHeroProps {
  competition: ICompetition;
  now: number;
  phaseLabel: string;
  phaseBlurb: string;
  hasEntered: boolean;
  signedOut: boolean;
  isCreator: boolean;
  ctaLabel?: string;
  onCta?: () => void;
  ctaDisabled?: boolean;
}

export function CompetitionDetailHero({
  competition,
  now,
  phaseLabel,
  phaseBlurb,
  hasEntered,
  signedOut,
  isCreator,
  ctaLabel,
  onCta,
  ctaDisabled,
}: CompetitionDetailHeroProps) {
  const prize = getPrizeDisplay(competition);
  const entryFee = getEntryFee(competition);
  const countdown = formatCountdown(competition.deadline, now);
  const pct =
    competition.maxParticipants && competition.maxParticipants > 0
      ? Math.min(
          (competition.participants / competition.maxParticipants) * 100,
          100,
        )
      : null;

  return (
    <div className="relative overflow-hidden py-11 border-b border-ns-border">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(80% 120% at 82% 0%, var(--ns-accent-subtle) 0%, transparent 62%), repeating-linear-gradient(105deg, rgba(212,169,74,.05) 0 1px, transparent 1px 13px)",
        }}
      />
      <div className="relative min-w-0">
        <div className="flex items-center flex-wrap gap-3 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-ns-accent animate-ns-glow-pulse motion-reduce:animate-none" />
          <span className="font-ui text-[10px] font-bold uppercase tracking-[0.22em] text-ns-accent">
            {countdown.isPast
              ? phaseLabel
              : `${phaseLabel} · Closes in ${countdown.label}`}
          </span>
          <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted">
            {getHostName(competition)}
          </span>
          {competition.sponsor && (
            <SponsorBadge sponsor={competition.sponsor} variant="compact" />
          )}
        </div>

        {/* The description is deliberately not repeated here — it is the
              body of the brief immediately below (CompetitionBrief), and the
              two used to sit on separate tabs. */}
        <h1 className="font-heading font-light text-[2.75rem] lg:text-[4.25rem] leading-[0.98] tracking-[-0.02em] text-ns-ink max-w-[22ch] text-balance">
          {competition.title}
        </h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5 mt-8 py-5 border-y border-ns-border">
          <div className="min-w-0">
            <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted mb-1">
              Prize pool
            </p>
            <p className="font-heading text-[30px] leading-none text-ns-gold-bright truncate">
              {prize.amount}
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted mb-1">
              Category
            </p>
            <p className="font-heading text-[30px] leading-none text-ns-ink truncate">
              {competition.category}
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted mb-1">
              Entry
            </p>
            <p
              className={`font-heading text-[30px] leading-none truncate ${
                entryFee ? "text-ns-ink" : "text-ns-success"
              }`}
            >
              {getEntryFeeLabel(competition)}
            </p>
          </div>
        </div>

        {competition.maxParticipants ? (
          <div className="mt-5 max-w-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-ui text-[11px] uppercase tracking-[0.14em] text-ns-ink-muted">
                Entrants
              </span>
              <span className="font-ui text-[11px] text-ns-ink-secondary tabular-nums">
                {competition.participants} / {competition.maxParticipants}
              </span>
            </div>
            {pct !== null && <Progress value={pct} />}
          </div>
        ) : null}

        <div className="mt-7">
          {ctaLabel ? (
            <Button
              size="lg"
              onClick={onCta}
              disabled={ctaDisabled}
              className="bg-ns-ink text-ns-bg hover:opacity-90 rounded-[10px] px-[30px]"
            >
              {ctaLabel}
            </Button>
          ) : hasEntered ? (
            <p className="font-body italic text-[15px] text-ns-ink-secondary">
              You're entered — see the entry card for details.
            </p>
          ) : signedOut ? (
            <p className="font-body italic text-[15px] text-ns-ink-secondary">
              Sign in to enter this competition.
            </p>
          ) : isCreator ? (
            <p className="font-body italic text-[15px] text-ns-ink-secondary">
              You organised this competition, so you can't enter it yourself.
            </p>
          ) : (
            <p className="font-body italic text-[15px] text-ns-ink-secondary">
              {phaseBlurb}
            </p>
          )}
        </div>
      </div>

      {competition.sponsor && (
        <div className="relative mt-8">
          <SponsorSection sponsor={competition.sponsor} />
        </div>
      )}
    </div>
  );
}

export default CompetitionDetailHero;
