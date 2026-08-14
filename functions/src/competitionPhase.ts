/**
 * Competition lifecycle, server side.
 *
 * KEEP IN SYNC with src/lib/competitionPhase.ts. The frontend copy derives the
 * display status; this copy is the authority for whether a transition is legal.
 * Both are pure and dependency-free so they can be tested directly.
 *
 *   draft ──publish──> scheduled ──> open ──> voting ──> settling ──> settled
 *     │                    └───────────┴────────┴────> cancelled
 *     └── discarded (hard delete; a draft holds no escrow)
 *
 * `draft` is authoring: unfunded, private to its creator, and the ONLY phase the
 * clock never moves. Publishing is what funds escrow, and it lands in
 * `scheduled` or, if the start date has already passed, straight in `open`.
 *
 * `settling` exists because paying out cannot be one atomic step: escrow
 * release runs its own transaction (and, once on-chain, is asynchronous and
 * can stay pending for minutes). Claiming `settling` first freezes voting —
 * castCompetitionVote requires exactly `voting` — so the tally cannot move
 * underneath a settlement that has already begun, and a crashed run can be
 * retried deterministically.
 *
 * A competition in `settling` cannot be cancelled: the money is already being
 * moved.
 */

export type CompetitionPhase =
  | "draft"
  | "scheduled"
  | "open"
  | "voting"
  | "settling"
  | "settled"
  | "cancelled";

export type EscrowState =
  | "unfunded"
  | "funding"
  | "funded"
  | "released"
  | "refunded";

export const TERMINAL_PHASES: readonly CompetitionPhase[] = [
  "settled",
  "cancelled",
];

export const isTerminalPhase = (phase: CompetitionPhase): boolean =>
  TERMINAL_PHASES.includes(phase);

/**
 * Legal forward transitions. Enumerated rather than inferred because every
 * edge either moves money or closes a window users are acting in.
 */
const ALLOWED_TRANSITIONS: Record<CompetitionPhase, CompetitionPhase[]> = {
  // `draft -> open` is legal because publishing a competition whose start date
  // has already passed should open it, not park it in `scheduled` forever.
  draft: ["scheduled", "open", "cancelled"],
  scheduled: ["open", "cancelled"],
  open: ["voting", "cancelled"],
  voting: ["settling", "cancelled"],
  // Once settlement has claimed the competition the only way out is finishing
  // it. Cancelling here would race a payout that may already have happened.
  settling: ["settled"],
  settled: [],
  cancelled: [],
};

export function canTransition(
  from: CompetitionPhase,
  to: CompetitionPhase,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Phase the clock says a competition should be in, or null if nothing is due.
 *
 * `voting -> settling` is deliberately excluded: settling moves money, so only
 * settleCompetition may claim it. The clock merely schedules the attempt.
 */
export function dueTimePhase(
  phase: CompetitionPhase,
  startDate: Date,
  deadline: Date,
  now: number = Date.now(),
): CompetitionPhase | null {
  // `draft` is absent on purpose: an unpublished competition holds no escrow and
  // has never been shown to anyone, so no date may open it. Only publishing can.
  if (phase === "scheduled" && now >= startDate.getTime()) return "open";
  if (phase === "open" && now > deadline.getTime()) return "voting";
  return null;
}

/**
 * When this competition next needs attention. Written to `nextTransitionAt` so
 * a future scheduled sweep can query `phase in [open, voting] && <= now`
 * without a data migration — nothing reads it yet.
 */
export function nextTransitionAt(
  phase: CompetitionPhase,
  startDate: Date,
  deadline: Date,
  votingDeadline?: Date | null,
): Date | null {
  switch (phase) {
    case "scheduled":
      return startDate;
    case "open":
      return deadline;
    case "voting":
      return votingDeadline ?? null;
    // `draft` included: nothing about it is time-driven.
    default:
      return null;
  }
}

/** Phases in which a competition's details may still be edited. */
export const isEditablePhase = (phase: CompetitionPhase): boolean =>
  phase === "draft" || phase === "scheduled" || phase === "open";

/** Unpublished: no escrow, private to its creator, discardable. */
export const isDraftPhase = (phase: CompetitionPhase): boolean =>
  phase === "draft";
