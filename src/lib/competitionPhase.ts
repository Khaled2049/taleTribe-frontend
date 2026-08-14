/**
 * Competition phase -> display status.
 *
 * `status` is what the explore list filters on (`STATUS_TABS` in
 * Competitions.tsx, `statusMeta` in CompetitionCard.tsx). It has never been
 * stored: it was computed from the dates on every read. Introducing a stored
 * `phase` therefore has to keep producing the same three values, or that UI
 * breaks.
 *
 * This module is deliberately dependency-free so it can be unit tested
 * directly, and so the same logic can be mirrored server-side without dragging
 * in Firestore types.
 */
import type { CompetitionPhase, CompetitionStatus } from "@/types/ICompetition";

/**
 * The original date-only derivation, kept verbatim for documents written
 * before `phase` existed. Do not "improve" it — its job is to reproduce
 * exactly what those documents used to display.
 */
export function deriveStatusFromDates(
  startDate: Date,
  deadline: Date,
  now: number = Date.now(),
): CompetitionStatus {
  if (now < startDate.getTime()) return "upcoming";
  if (now > deadline.getTime()) return "completed";
  return "active";
}

/**
 * Display status for a competition.
 *
 * A stored `phase` always wins. `voting` maps to `active` because a competition
 * being voted on is still live to a reader, even though submissions have
 * closed. When `phase` is absent — every pre-existing document — this falls
 * back to the date logic, so nothing needs backfilling before the UI is correct.
 */
export function deriveCompetitionStatus(
  phase: CompetitionPhase | undefined,
  startDate: Date,
  deadline: Date,
  now: number = Date.now(),
): CompetitionStatus {
  switch (phase) {
    case "draft":
      return "upcoming";
    case "open":
    case "voting":
    case "settling":
      // `settling` counts as active: voting is over, but nothing has been
      // decided or paid yet, and showing "completed" before the payout lands
      // would claim more than is true.
      return "active";
    case "settled":
    case "cancelled":
      return "completed";
    default:
      return deriveStatusFromDates(startDate, deadline, now);
  }
}

/** Phases a competition can no longer move out of. `settling` is transient. */
export const TERMINAL_PHASES: readonly CompetitionPhase[] = [
  "settled",
  "cancelled",
];

export const isTerminalPhase = (phase: CompetitionPhase | undefined): boolean =>
  phase !== undefined && TERMINAL_PHASES.includes(phase);

/**
 * Legal forward transitions. Every edge either moves money or closes a window
 * users are acting in, so the set is enumerated rather than inferred, and the
 * server checks it on both the scheduled and the manual path.
 */
const ALLOWED_TRANSITIONS: Record<CompetitionPhase, CompetitionPhase[]> = {
  draft: ["open", "cancelled"],
  open: ["voting", "cancelled"],
  voting: ["settling", "cancelled"],
  // Settlement has claimed it and money may already have moved.
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
 * Phases whose details may still be edited. Mirrors `isEditablePhase` in
 * functions/src/competitionPhase.ts — `updateCompetition` answers 409 outside
 * these, so a UI offering the action anywhere else is offering a dead end.
 */
export const isEditablePhase = (phase: CompetitionPhase): boolean =>
  phase === "draft" || phase === "open";

/**
 * Phase a competition *should* be in given the clock, ignoring settlement,
 * which needs a tally and therefore cannot be decided here.
 *
 * Returns null when no time-driven change is due. `voting -> settled` is
 * deliberately excluded: only the settlement transaction may make that move.
 */
export function dueTimePhase(
  phase: CompetitionPhase,
  startDate: Date,
  deadline: Date,
  now: number = Date.now(),
): CompetitionPhase | null {
  if (phase === "draft" && now >= startDate.getTime()) return "open";
  if (phase === "open" && now > deadline.getTime()) return "voting";
  return null;
}

/**
 * When this competition next needs attention, for the `nextTransitionAt` field
 * a future scheduled sweep will query on. Null once nothing further is
 * time-driven.
 */
export function nextTransitionAt(
  phase: CompetitionPhase,
  startDate: Date,
  deadline: Date,
  votingDeadline?: Date,
): Date | null {
  switch (phase) {
    case "draft":
      return startDate;
    case "open":
      return deadline;
    case "voting":
      return votingDeadline ?? null;
    default:
      return null;
  }
}
