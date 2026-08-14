import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { formatCountdown } from "@/hooks/useCountdown";
import {
  useDemoTimeline,
  usePrefersReducedMotion,
  type DemoStep,
} from "@/hooks/useDemoTimeline";
import { canTransition } from "@/lib/competitionPhase";
import { PHASE_COPY } from "@/lib/competitionPhaseCopy";
import { CountdownTile } from "./CompetitionCountdown";
import type { CompetitionPhase } from "@/types/ICompetition";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface WalkthroughStep extends DemoStep {
  phase: CompetitionPhase;
  /** Eyebrow above the clock, e.g. "Entries close in". */
  clockLabel: string;
  heading: string;
  body: string;
  /** What is happening to the prize pool during this phase. */
  money: string;
}

/**
 * The five phases in the order a competition actually moves through them.
 *
 * `cancelled` is not a step: it is a branch off the first three, rendered
 * separately below the rail. Which phases it branches from is derived from
 * `canTransition` rather than restated here — that function is the same
 * authority the server checks against, so this diagram cannot quietly disagree
 * with the rules it is describing.
 */
const STEPS: WalkthroughStep[] = [
  {
    phase: "draft",
    playMs: 4800,
    countdownFromMs: 2 * DAY,
    clockLabel: "Opens in",
    heading: "The prize is put up front",
    body: "A host sets the brief, the dates and the prize, and the prize leaves their balance the moment the competition is created.",
    money: "The pool is already held in escrow. If that funding never confirms, the competition stays here — it will not open promising a prize nobody can pay.",
  },
  {
    phase: "open",
    playMs: 6800,
    countdownFromMs: 5 * DAY,
    clockLabel: "Entries close in",
    heading: "Writers enter",
    body: "Anyone can join and enter one published story. You can swap your entry out right up until the deadline, and the host cannot enter their own competition.",
    money: "The pool sits untouched in escrow while entries come in. Entering is free — nothing is deducted from your balance.",
  },
  {
    phase: "voting",
    playMs: 6400,
    countdownFromMs: 3 * DAY,
    clockLabel: "Voting closes in",
    heading: "The tribe reads and votes",
    body: "Entries close and ballots open. Each reader backs up to three entries and cannot back their own. Entries are shown in a different order to every reader, so nobody gets a head start from being first on the page.",
    money: "Still escrowed, still untouched. Running vote counts are hidden from everyone — including the host — so nobody can pile onto whoever is ahead.",
  },
  {
    phase: "settling",
    playMs: 3800,
    clockLabel: "In progress",
    heading: "Votes are counted",
    body: "Voting freezes and the result is worked out: most votes wins, with the earlier submission taking it if two entries tie.",
    money: "The payout is in flight. Freezing voting first is what stops the count shifting underneath a payment that has already started — and it means an interrupted payout can be safely retried.",
  },
  {
    phase: "settled",
    playMs: 5600,
    clockLabel: "Done",
    heading: "The winner is paid",
    body: "The result is published along with the full standings, and the prize lands in the winner's balance.",
    money: "The whole pool goes to first place. A SHA-256 digest of the results is published next to them, so anyone can recompute it and check the result was not edited after the fact.",
  },
];

/** Phases a competition can still be called off from — straight from the rules. */
const CANCELLABLE = STEPS.filter((step) =>
  canTransition(step.phase, "cancelled"),
).map((step) => step.phase);

/** "draft, open or voting" */
const listPhases = (phases: CompetitionPhase[]): string =>
  phases.length <= 1
    ? (phases[0] ?? "")
    : `${phases.slice(0, -1).join(", ")} or ${phases[phases.length - 1]}`;

function Clock({
  remainingMs,
  label,
  phase,
}: {
  remainingMs: number | null;
  label: string;
  phase: CompetitionPhase;
}) {
  const countdown =
    remainingMs === null ? null : formatCountdown(remainingMs, 0);

  return (
    <div className="rounded-[14px] border border-ns-border bg-ns-elevated p-[22px]">
      <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted mb-3">
        {label}
      </p>

      {countdown ? (
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
      ) : (
        <div className="flex items-center gap-3 py-3">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              phase === "settled"
                ? "bg-ns-gold"
                : "bg-ns-accent animate-ns-glow-pulse motion-reduce:animate-none"
            }`}
          />
          <p className="font-heading text-[32px] leading-none text-ns-ink">
            {PHASE_COPY[phase].label}
          </p>
        </div>
      )}
    </div>
  );
}

export function PhaseWalkthrough() {
  const reduced = usePrefersReducedMotion();
  const { index, progress, playing, remainingMs, goTo, next, prev, toggle } =
    useDemoTimeline(STEPS, { autoplay: !reduced });

  const step = STEPS[index];
  const transition = reduced ? { duration: 0 } : { duration: 0.32 };

  return (
    <section aria-label="How a competition progresses">
      {/* Phase rail */}
      <ol className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
        {STEPS.map((item, i) => {
          const active = i === index;
          const done = i < index;
          return (
            <li
              key={item.phase}
              className="flex items-center gap-2 sm:flex-1 sm:min-w-0"
            >
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={active ? "step" : undefined}
                className="group relative flex items-center gap-2.5 sm:flex-col sm:items-start sm:gap-2 sm:w-full text-left"
              >
                <span className="flex items-center gap-2.5 sm:w-full">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
                      active
                        ? "bg-ns-accent"
                        : done
                          ? "bg-ns-ink-muted"
                          : "bg-ns-border-strong group-hover:bg-ns-ink-muted"
                    }`}
                  />
                  <span className="hidden sm:block h-px flex-1 bg-ns-border" />
                </span>
                <span
                  className={`font-ui text-[11px] uppercase tracking-[0.14em] transition-colors ${
                    active
                      ? "text-ns-ink font-semibold"
                      : "text-ns-ink-muted group-hover:text-ns-ink-secondary"
                  }`}
                >
                  {PHASE_COPY[item.phase].label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Progress through the current step */}
      <div className="mt-4 h-px w-full bg-ns-border overflow-hidden">
        <div
          className="h-px bg-ns-accent"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr] gap-8 lg:gap-12 items-start mt-8">
        <Clock
          remainingMs={remainingMs}
          label={step.clockLabel}
          phase={step.phase}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={step.phase}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -8 }}
            transition={transition}
          >
            <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-ns-accent mb-3">
              Step {index + 1} of {STEPS.length}
            </p>
            <h3 className="font-heading text-[34px] leading-[1.1] text-ns-ink">
              {step.heading}
            </h3>
            <p className="font-body text-[17px] leading-[1.6] text-ns-ink-secondary max-w-[56ch] mt-4">
              {step.body}
            </p>
            <div className="mt-5 pt-5 border-t border-ns-border">
              <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-ns-ink-muted mb-2">
                Where the prize is
              </p>
              <p className="font-body text-[16px] leading-[1.6] text-ns-ink-secondary max-w-[56ch]">
                {step.money}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mt-9">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-2 rounded-full border border-ns-border px-[14px] py-[7px] font-ui text-xs font-semibold text-ns-ink-secondary hover:text-ns-ink hover:border-ns-border-strong transition-colors"
        >
          {playing ? (
            <>
              <Pause className="w-3 h-3" /> Pause
            </>
          ) : (
            <>
              <Play className="w-3 h-3" /> Play
            </>
          )}
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={prev}
          aria-label="Previous phase"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-ns-border text-ns-ink-secondary hover:text-ns-ink hover:border-ns-border-strong transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next phase"
          className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-ns-border text-ns-ink-secondary hover:text-ns-ink hover:border-ns-border-strong transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* The one branch off the happy path */}
      <div className="mt-8 rounded-[14px] border border-dashed border-ns-border-strong bg-ns-surface p-[22px]">
        <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-ns-ink-muted mb-2">
          If it is called off
        </p>
        <p className="font-body text-[16px] leading-[1.6] text-ns-ink-secondary max-w-[64ch]">
          A competition can be called off while it is still{" "}
          {listPhases(CANCELLABLE)} — never once the payout has started.
          Cancelling refunds the whole pool to the host, so a competition holding
          a prize is never simply deleted.
        </p>
      </div>
    </section>
  );
}

export default PhaseWalkthrough;
