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
 *   draft ──publish──> scheduled ──> open ──> voting ──> settling ──> settled
 *     │                    └───────────┴────────┴────> cancelled
 *     └── discarded (hard delete; a draft holds no escrow)
 *
 * `draft` is authoring: unfunded, private to its creator, and never moved by the
 * clock. Publishing funds escrow and lands in `scheduled`, or in `open` when the
 * start date has already passed.
 *
 * `settling` covers a payout in flight, so paying does not have to succeed or
 * fail atomically with a phase write — the assumption that lets escrow move
 * on-chain later.
 */
export type CompetitionPhase =
  | "draft"
  | "scheduled"
  | "open"
  | "voting"
  | "settling"
  | "settled"
  | "cancelled";

/** Lifecycle of the prize pool held for a competition. */
export type EscrowState =
  "unfunded" | "funding" | "funded" | "released" | "refunded";

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
  /**
   * What each entrant pays to submit; absent or zero means free. NOT added to
   * the prize — it is revenue split between the host and the platform at
   * settlement, and `prizePool` alone is what the winner receives.
   */
  entryFee?: ITokenAmount;
  /** Platform's share of the entry fees, in basis points. Fixed at creation. */
  feeBps?: number;
  /** Fees in escrow now. Escrow's balance is `prizePool + entryFeesHeld`. */
  entryFeesHeld?: MinorUnits;
  /** How the fees were actually split. Written once, at settlement. */
  entryFeesSettled?: { platform: MinorUnits; host: MinorUnits };
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
  /**
   * False only while `phase === "draft"`. Denormalized from the phase because
   * Firestore rules and list queries match on fields, not on derived state —
   * the explore query constrains on it and the rules gate reads with it.
   */
  published?: boolean;
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
  /** What each entrant pays. Omit or pass "0" for a free competition. */
  entryFee?: MinorUnits;
  creatorName?: string;
}

/**
 * An unpublished draft. Only the title is required — the point of a draft is
 * that it can be saved half-finished, and the strict checks run at publish.
 *
 * Omit `competitionId` to create; supply it to overwrite an existing draft.
 */
export interface ICompetitionDraftInput {
  competitionId?: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  maxParticipants?: number | null;
  startDate?: Date;
  deadline?: Date;
  votingDeadline?: Date;
  prizeAmount?: MinorUnits;
  entryFee?: MinorUnits;
  creatorName?: string;
}

/**
 * Editable fields on a PUBLISHED competition. The prize and entry fee are
 * deliberately absent: both are immutable once escrow holds money against them,
 * and the server returns 422 if either is supplied. While still a draft, they
 * are ordinary fields on `ICompetitionDraftInput`.
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
