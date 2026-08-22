import type { ICompetition } from "@/types/ICompetition";
import type { ITokenAmount } from "@/types/IToken";
import {
  DEFAULT_FEE_BPS,
  formatMinorUnits,
  formatTokenAmount,
} from "@/lib/money";

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
 * Minimum gap between submissions closing and voting closing.
 *
 * KEEP IN SYNC with MIN_VOTING_WINDOW_MS in
 * functions/src/competitionValidation.ts, which is the authority — publish
 * rejects a shorter window whatever this says.
 */
export const MIN_VOTING_WINDOW_MS = 60 * 60 * 1000;

/**
 * The entry fee, or `null` when entering is free.
 *
 * Absence and a zero amount both mean free, collapsed here so no caller has to
 * remember both.
 */
export function getEntryFee(competition: ICompetition): ITokenAmount | null {
  const fee = competition.entryFee;
  if (!fee || BigInt(fee.amount) <= 0n) return null;
  return fee;
}

export function isPaidEntry(competition: ICompetition): boolean {
  return getEntryFee(competition) !== null;
}

/** "Free" or "25 TALE" — the Entry column, and the entry CTA. */
export function getEntryFeeLabel(competition: ICompetition): string {
  const fee = getEntryFee(competition);
  return fee ? formatTokenAmount(fee) : "Free";
}

/**
 * Platform's cut, falling back to the default for pre-fee documents.
 *
 * The rate is the only fee thing the client may know. Computing the resulting
 * amounts belongs to `splitEntryFees` in functions/src/competitionSettlementCore.ts
 * — a copy here could drift and show a host a number they do not receive.
 */
export function getFeeBps(competition: ICompetition): number {
  return typeof competition.feeBps === "number"
    ? competition.feeBps
    : DEFAULT_FEE_BPS;
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
