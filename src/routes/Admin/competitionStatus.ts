import { canTransition, isVotingClosed } from "@/lib/competitionPhase";
import type { CompetitionPhase } from "@/types/ICompetition";

/** Matches the `awaiting-settlement` filter story-data's admin list accepts. */
export const AWAITING_SETTLEMENT = "awaiting-settlement";

const HOUR = 60 * 60 * 1000;

const overdueFor = (ms: number): string => {
  if (ms < HOUR) return "under an hour";
  const hours = Math.floor(ms / HOUR);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${Math.floor(hours / 24)} days`;
};

/**
 * How long a competition has sat past its voting deadline without settling, or
 * null if it is not waiting. Settlement happens on the first public read, so
 * this is a competition nobody has opened since voting closed.
 */
export function awaitingSettlementFor(
  phase: CompetitionPhase,
  votingDeadline: string | null,
  now: number = Date.now(),
): string | null {
  const deadline = votingDeadline ? new Date(votingDeadline) : undefined;
  if (phase !== "voting" || !isVotingClosed(phase, deadline, now)) return null;
  return overdueFor(now - (deadline as Date).getTime());
}

const competitions = (n: number) =>
  `${n} ${n === 1 ? "competition" : "competitions"}`;

/** The toast after "Settle all overdue". Failures arrive as ids only. */
export function settleDueSummary(result: {
  settled: string[];
  failed: string[];
}): string {
  const { settled, failed } = result;
  if (settled.length === 0 && failed.length === 0)
    return "Nothing was waiting to settle.";
  const parts: string[] = [];
  if (settled.length > 0)
    parts.push(`Settled ${competitions(settled.length)}.`);
  if (failed.length > 0)
    parts.push(
      `${competitions(failed.length)} could not be settled and ${
        failed.length === 1 ? "is" : "are"
      } still awaiting settlement; the story-data logs say why.`,
    );
  return parts.join(" ");
}

/**
 * Whether the admin page offers Cancel. A draft is deleted rather than
 * cancelled, since it holds no escrow; the server refuses anything settled.
 */
export const canAdminCancel = (phase: CompetitionPhase): boolean =>
  phase !== "draft" && canTransition(phase, "cancelled");

export const MAX_CANCEL_REASON = 500;
