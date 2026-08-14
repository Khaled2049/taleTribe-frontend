import type { ITokenAmount, MinorUnits } from "./IToken";

/**
 * Coarse bucket the explore list filters on. DERIVED, never stored — see
 * `deriveCompetitionStatus` in @/lib/competitionPhase.
 */
export type CompetitionStatus = "active" | "upcoming" | "completed";

/**
 * The real lifecycle. Stored on the document and written only by Cloud
 * Functions, because each transition moves money or decides who receives it.
 *
 *   draft ──> open ──> voting ──> settling ──> settled
 *     └──────────┴─────────┴────> cancelled
 *
 * `draft` covers a competition whose escrow funding has not confirmed yet, and
 * `settling` covers one whose payout is in flight — so neither funding nor
 * payout has to succeed or fail atomically with a phase write. Those are the
 * two assumptions that could not survive moving escrow on-chain.
 */
export type CompetitionPhase =
  | "draft"
  | "open"
  | "voting"
  | "settling"
  | "settled"
  | "cancelled";

/** Lifecycle of the prize pool held for a competition. */
export type EscrowState =
  | "unfunded"
  | "funding"
  | "funded"
  | "released"
  | "refunded";

/** One line of the final standings, exactly as settlement recorded it. */
export interface ICompetitionResult {
  rank: number;
  userId: string;
  submissionId: string;
  votes: number;
  /** TALE in integer minor units — display only on the client. */
  amount: MinorUnits;
}

/**
 * Per-competition voting rules.
 *
 * Absent on every competition written so far — nothing sets it yet — in which
 * case the platform default applies. Surfaced on the client so the UI polices
 * the same number the server does; see `getMaxVotesPerUser`.
 */
export interface IVotingRules {
  /** How many entries one voter may back. */
  maxVotesPerUser?: number;
}

export interface ISponsor {
  id?: string;
  name: string;
  logo?: string; // URL to sponsor logo
  website?: string; // Sponsor website URL
  message?: string; // Pinned sponsor message
  tier?: "platinum" | "gold" | "silver" | "bronze"; // Sponsor tier for different visibility levels
}

export interface ICompetition {
  id: string;
  title: string;
  description: string;
  /** @deprecated Decorative legacy field. Use `prizePool`; see `legacyPrizeLabel`. */
  prizeAmount: number;
  /** @deprecated Decorative legacy field. Use `prizePool`. */
  prizeCurrency: string;
  /** Escrowed prize, in integer minor units. Absent on pre-TALE competitions. */
  prizePool?: ITokenAmount;
  escrowState?: EscrowState;
  /**
   * Rendered instead of `prizePool` on competitions created before TALE
   * existed, e.g. "1,000 USDC". Those pools were never funded, so showing them
   * as real TALE would be a lie.
   */
  legacyPrizeLabel?: string;
  /** Final standings. Written once, at settlement. */
  results?: ICompetitionResult[];
  /**
   * SHA-256 of the canonical results payload, stored alongside it as
   * `resultsDigestPayload` so anyone can recompute and verify this rather than
   * taking it on trust.
   */
  resultsDigest?: string;
  /** When settlement completed. Absent until `phase === "settled"`. */
  settledAt?: Date;
  /** Submissions close. Kept as `deadline` — it is already in queries and the form. */
  deadline: Date;
  startDate: Date;
  /** Voting closes. Absent on legacy documents. */
  votingDeadline?: Date;
  phase?: CompetitionPhase;
  /** Entries with status "submitted". Server-maintained. */
  submissionCount?: number;
  /**
   * Total ballots cast. Safe to publish — it shows participation and reveals
   * nothing about who is ahead, unlike a per-entry count.
   */
  ballotCount?: number;
  votingRules?: IVotingRules;
  status: CompetitionStatus;
  participants: number;
  maxParticipants?: number;
  tags: string[];
  category: string;
  organizer: string;
  creatorId?: string;
  creatorName?: string;
  isJoined?: boolean;
  rules?: string[];
  evaluationCriteria?: string;
  sponsor?: ISponsor; // Optional sponsor information
}

/** @deprecated Shape of the old client-side create. Use ICompetitionCreateInput. */
export interface ICompetitionInput {
  title: string;
  description: string;
  prizeAmount: number;
  prizeCurrency: string;
  startDate: Date;
  deadline: Date;
  maxParticipants?: number | null;
  tags: string[];
  category: string;
}

/**
 * Payload for the server-side `createCompetition`.
 *
 * `prizeAmount` is TALE in integer minor units — the creator's balance is
 * debited by exactly this into escrow, so it is never a float.
 */
export interface ICompetitionCreateInput {
  title: string;
  description: string;
  category: string;
  tags: string[];
  maxParticipants?: number | null;
  startDate: Date;
  /** Submissions close. */
  deadline: Date;
  /** Voting closes. Must be at least an hour after `deadline`. */
  votingDeadline: Date;
  prizeAmount: MinorUnits;
  creatorName?: string;
}

/**
 * Editable fields. The prize is deliberately absent: it is immutable once
 * escrow is funded, and the server returns 422 if one is supplied.
 */
export interface ICompetitionUpdate {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  maxParticipants?: number | null;
  startDate?: Date;
  deadline?: Date;
  votingDeadline?: Date;
}
