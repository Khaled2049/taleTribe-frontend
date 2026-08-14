/**
 * Settlement arithmetic — ranking, payout, and the canonical results payload.
 *
 * This module has **zero imports**, deliberately. No firebase-admin, no crypto,
 * no money.ts. That is what lets it be unit tested directly by vitest (which
 * otherwise never touches functions/), and it means the logic that decides who
 * gets paid is exercised without needing an emulator.
 *
 * It is also the reason this logic is NOT duplicated into src/lib/ the way
 * money.ts and competitionPhase.ts are: duplicated formatting is survivable,
 * duplicated payout arithmetic is not — a divergence would change who gets
 * paid. The frontend never computes payouts; it renders what the server wrote.
 *
 * Amounts are base-10 integer strings in minor units, matching MinorUnits in
 * money.ts. All arithmetic here is BigInt.
 */

export interface RankableEntry {
  /** Document id of the submission, which is the entrant's uid. */
  submissionId: string;
  userId: string;
  votes: number;
  submittedAtMs: number;
}

export interface SettlementResult {
  /** 1-based. Rank 1 is the winner. */
  rank: number;
  userId: string;
  submissionId: string;
  votes: number;
  /** Minor units. "0" for a ranked entry that placed but won nothing. */
  amount: string;
}

export interface DigestResultEntry {
  rank: number;
  userId: string;
  submissionId: string;
  votes: number;
  amount: string;
}

export interface DigestPayload {
  /** Bumped to 2 when entry fees were added; a v1 payload named only the prize. */
  v: number;
  competitionId: string;
  assetId: string;
  pool: string;
  /** Entry fees held at settlement, in minor units. "0" on a free competition. */
  entryFees: string;
  /** Platform's share of `entryFees`, in basis points. */
  feeBps: number;
  votingClosedAtMs: number;
  results: DigestResultEntry[];
}

/** Platform and host shares of the entry fees collected by a competition. */
export interface FeeSplit {
  platform: string;
  host: string;
}

/**
 * Split entry fees between the platform and the host.
 *
 * The host's share is the exact remainder, never a second multiplication, so
 * the two always sum to `feesHeld` and escrow can still drain to zero. Same
 * arithmetic as TippingPlatform.calculateSplit().
 */
export function splitEntryFees(feesHeld: string, feeBps: number): FeeSplit {
  const total = BigInt(feesHeld);
  if (total <= 0n) return { platform: "0", host: "0" };

  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000) {
    throw new Error(`splitEntryFees: feeBps must be an integer in [0, 10000], got ${feeBps}`);
  }

  const platform = (total * BigInt(feeBps)) / 10000n;
  return { platform: platform.toString(), host: (total - platform).toString() };
}

/**
 * Order entries into a **total** order: most votes first, then the earlier
 * submission, then the lexicographically smaller id.
 *
 * The third comparison is arbitrary, and mandatory. Without it two entries with
 * identical votes and identical timestamps would have no defined order, and the
 * results digest would not be reproducible — which is the whole point of
 * publishing one. `Array.prototype.sort` stability is not relied upon.
 */
export function rankEntries(entries: RankableEntry[]): RankableEntry[] {
  return [...entries].sort((a, b) => {
    if (a.votes !== b.votes) return b.votes - a.votes;
    if (a.submittedAtMs !== b.submittedAtMs) {
      return a.submittedAtMs - b.submittedAtMs;
    }
    if (a.submissionId < b.submissionId) return -1;
    if (a.submissionId > b.submissionId) return 1;
    return 0;
  });
}

/**
 * Winner-take-all: the whole pool goes to rank 1.
 *
 * Returns `[]` when there is nobody to pay — either no entries at all, or no
 * entry received a single vote. In both cases the caller refunds the creator
 * rather than awarding a prize nobody earned. Returning an empty array (rather
 * than throwing) keeps "nobody won" an ordinary outcome, not an error.
 *
 * Every other ranked entry is included with `amount: "0"` so the digest records
 * the complete standing, not just the winner.
 */
export function computePayouts(
  ranked: RankableEntry[],
  pool: string,
): SettlementResult[] {
  if (ranked.length === 0) return [];

  const poolAmount = BigInt(pool);
  if (poolAmount <= 0n) return [];

  // No votes at all means no community signal. Paying the earliest submission
  // would award a prize on submission time alone.
  if (ranked[0].votes <= 0) return [];

  return ranked.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    submissionId: entry.submissionId,
    votes: entry.votes,
    amount: index === 0 ? poolAmount.toString() : "0",
  }));
}

/** Total of every payout, for the caller's escrow-drains-to-zero assertion. */
export function totalPayout(results: SettlementResult[]): string {
  return results
    .reduce((sum, result) => sum + BigInt(result.amount), 0n)
    .toString();
}

/**
 * Build the canonical payload that gets hashed into `resultsDigest`.
 *
 * The object is constructed as a **literal with a fixed key order**, and the
 * result entries are rebuilt field by field rather than spread. Serializing an
 * arbitrary object would let key order vary with how it was assembled, and the
 * digest would stop being reproducible.
 *
 * `json` is the exact string to hash — no whitespace, no indentation.
 */
export function buildDigestPayload(args: {
  competitionId: string;
  assetId: string;
  pool: string;
  entryFees: string;
  feeBps: number;
  votingClosedAtMs: number;
  results: SettlementResult[];
}): { payload: DigestPayload; json: string } {
  const payload: DigestPayload = {
    v: 2,
    competitionId: args.competitionId,
    assetId: args.assetId,
    pool: args.pool,
    entryFees: args.entryFees,
    feeBps: args.feeBps,
    votingClosedAtMs: args.votingClosedAtMs,
    results: [...args.results]
      .sort((a, b) => a.rank - b.rank)
      .map((result) => ({
        rank: result.rank,
        userId: result.userId,
        submissionId: result.submissionId,
        votes: result.votes,
        amount: result.amount,
      })),
  };

  return { payload, json: JSON.stringify(payload) };
}

/**
 * Entries eligible for ranking.
 *
 * The tally document is written with `{merge: true}` over a whole counts map,
 * so a withdrawn entrant's key survives in it. Ranking must therefore be driven
 * by the submissions list — filtered to `status === "submitted"` — with the
 * tally consulted only for counts. Trusting the tally's key set would pay
 * somebody who pulled out.
 */
export function buildRankableEntries(
  submissions: Array<{
    submissionId: string;
    userId: string;
    status: string;
    submittedAtMs: number;
  }>,
  counts: Record<string, number>,
): RankableEntry[] {
  return submissions
    .filter((submission) => submission.status === "submitted")
    .map((submission) => ({
      submissionId: submission.submissionId,
      userId: submission.userId,
      submittedAtMs: submission.submittedAtMs,
      votes:
        typeof counts[submission.submissionId] === "number" &&
        counts[submission.submissionId] > 0
          ? counts[submission.submissionId]
          : 0,
    }));
}
