import type { ICompetition } from "@/types/ICompetition";
import { formatMinorUnits } from "@/lib/money";

/** Prize display, honoring the legacy-pool rule: pre-TALE competitions show their label, not a fabricated TALE amount. */
export function getPrizeDisplay(competition: ICompetition): {
  amount: string;
  symbol: string;
} {
  if (competition.prizePool) {
    return {
      amount: formatMinorUnits(
        competition.prizePool.amount,
        competition.prizePool.decimals,
      ),
      symbol: competition.prizePool.symbol,
    };
  }
  return { amount: competition.legacyPrizeLabel ?? "—", symbol: "" };
}

export function getHostName(competition: ICompetition): string {
  return competition.organizer || competition.creatorName || "Unknown host";
}

/**
 * Whether the viewer has joined but has no visible next step surfaced by the
 * list query — the closest available analog to the design's "has a draft"
 * state, since this backend has no separate draft/compose step: joining and
 * submitting are both instant actions, not a saved-in-progress entry.
 */
export function hasJoinedWithoutSubmitting(competition: ICompetition): boolean {
  return Boolean(competition.isJoined) && competition.status === "active";
}

export function isCompetitionFull(competition: ICompetition): boolean {
  return (
    !!competition.maxParticipants &&
    competition.participants >= competition.maxParticipants
  );
}

/**
 * Platform default for how many entries one voter may back.
 *
 * KEEP IN SYNC with DEFAULT_MAX_VOTES_PER_USER in
 * functions/src/competitionEntryEndpoints.ts. That copy is the authority —
 * castCompetitionVote rejects a longer ballot with a 400 whatever this says.
 */
export const DEFAULT_MAX_VOTES_PER_USER = 3;

/**
 * How many entries this competition lets one voter back.
 *
 * Reads the same per-competition override the server reads, so the UI can no
 * longer police a different number than the endpoint enforces. A non-positive
 * or non-integer override is ignored rather than trusted: it would make the
 * button state nonsensical while the server carried on using its own reading.
 */
export function getMaxVotesPerUser(competition: ICompetition): number {
  const configured = competition.votingRules?.maxVotesPerUser;
  return typeof configured === "number" &&
    Number.isInteger(configured) &&
    configured > 0
    ? configured
    : DEFAULT_MAX_VOTES_PER_USER;
}
