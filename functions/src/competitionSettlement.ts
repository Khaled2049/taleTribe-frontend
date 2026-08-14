/**
 * Settling a competition: rank, pay, record.
 *
 * ## Why this is not one transaction
 *
 * `escrow.release()` runs its own Firestore transaction, and once escrow moves
 * on-chain it becomes an asynchronous call that can stay pending for minutes.
 * It therefore cannot be nested inside a settlement transaction, and writing
 * the ledger postings inline instead would bypass EscrowProvider — the seam the
 * whole design exists to protect.
 *
 * That leaves an ordering hazard: if the payout succeeds but the phase write
 * then fails, a retry recomputes the results — and if the competition were
 * still in `voting`, more votes could have arrived meanwhile. The payout
 * (correctly idempotent) would not repeat, but we would record a result that
 * differs from the one actually paid.
 *
 * ## The fix: claim `settling` first
 *
 * Settlement begins by CASing `voting -> settling`. `castCompetitionVote`
 * already requires exactly `voting`, so votes are refused from that instant
 * with no change to it. The tally is then frozen, so every retry recomputes a
 * byte-identical result, calls release under the same idempotency key (a no-op
 * if it already ran), and finishes the phase write.
 *
 * Failing anywhere leaves the competition visibly stuck in `settling` — never
 * silently half-settled — and re-running is always safe.
 */
import { createHash } from "crypto";
import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { getEscrowProvider } from "./escrow";
import { DEFAULT_FEE_BPS, assertMinorUnits } from "./money";
import { CompetitionPhase } from "./competitionPhase";
import {
  buildUnwindRefunds,
  readHeldContributions,
  totalContributions,
} from "./competitionContributions";
import {
  SettlementResult,
  buildDigestPayload,
  buildRankableEntries,
  computePayouts,
  rankEntries,
  splitEntryFees,
  totalPayout,
} from "./competitionSettlementCore";

/**
 * Cap on submissions read in one settlement pass. Matches the entry cap
 * enforced by submitToCompetition — keep the two in sync.
 */
const MAX_SUBMISSIONS_READ = 500;

const fail = (message: string, statusCode: number): Error =>
  Object.assign(new Error(message), { statusCode });

export interface SettlementOutcome {
  competitionId: string;
  phase: CompetitionPhase;
  results: SettlementResult[];
  resultsDigest: string;
  /** True when this call did the work; false when it was already settled. */
  settledNow: boolean;
  /** Set when nobody won and the pool went back to the creator. */
  refunded: boolean;
}

interface ClaimOutcome {
  alreadySettled: boolean;
  results: SettlementResult[];
  resultsDigest: string;
  claimedAtMs: number;
  refunded: boolean;
}

/**
 * Take ownership of settlement, freezing voting.
 *
 * Accepts a competition already in `settling` so a crashed run can resume.
 * Returns early with the stored results if it is already settled — retries must
 * be safe, so that is a success, not an error.
 */
async function claimSettlement(
  db: Firestore,
  competitionId: string,
): Promise<ClaimOutcome> {
  const ref = db.collection("competitions").doc(competitionId);

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw fail("Competition not found", 404);

    const data = snapshot.data() ?? {};
    const phase: CompetitionPhase = (data.phase as CompetitionPhase) ?? "open";

    if (phase === "settled") {
      return {
        alreadySettled: true,
        results: (data.results as SettlementResult[]) ?? [],
        resultsDigest: (data.resultsDigest as string) ?? "",
        claimedAtMs: (data.settlementClaimedAtMs as number) ?? 0,
        refunded: data.escrowState === "refunded",
      };
    }

    if (phase !== "voting" && phase !== "settling") {
      throw fail(
        `A competition in the ${phase} phase cannot be settled`,
        409,
      );
    }

    // Reuse the original claim time on a resumed run: the digest embeds it, so
    // a fresh timestamp would produce a different hash for the same outcome.
    const claimedAtMs =
      typeof data.settlementClaimedAtMs === "number"
        ? data.settlementClaimedAtMs
        : Date.now();

    if (phase === "voting") {
      tx.update(ref, {
        phase: "settling" as CompetitionPhase,
        settlementClaimedAtMs: claimedAtMs,
        phaseUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      alreadySettled: false,
      results: [],
      resultsDigest: "",
      claimedAtMs,
      refunded: false,
    };
  });
}

/**
 * Rank, pay, and record. Idempotent at every step.
 *
 * Called by the admin endpoint and by the scheduled advance task.
 */
export async function settleCompetition(
  db: Firestore,
  competitionId: string,
): Promise<SettlementOutcome> {
  const claim = await claimSettlement(db, competitionId);

  if (claim.alreadySettled) {
    return {
      competitionId,
      phase: "settled",
      results: claim.results,
      resultsDigest: claim.resultsDigest,
      settledNow: false,
      refunded: claim.refunded,
    };
  }

  const ref = db.collection("competitions").doc(competitionId);
  const escrow = getEscrowProvider();

  // Reads happen outside a transaction: voting is frozen by the `settling`
  // claim, so nothing here can change underneath us.
  const [
    competitionSnapshot,
    tallySnapshot,
    submissionsSnapshot,
    escrowed,
    contributions,
  ] = await Promise.all([
    ref.get(),
    ref.collection("private").doc("tally").get(),
    ref.collection("submissions").limit(MAX_SUBMISSIONS_READ).get(),
    escrow.escrowedAmount(competitionId),
    readHeldContributions(db, competitionId),
  ]);

  const competition = competitionSnapshot.data() ?? {};
  const creatorId = competition.creatorId as string | undefined;
  if (!creatorId) throw fail("Competition has no creator to refund", 422);

  const poolAmount = (competition.prizePool?.amount as string) ?? "0";

  // Derived from the contribution documents, not the denormalized counter —
  // using the counter on both sides would make the assertion below vacuous.
  const entryFees = totalContributions(contributions);
  const counterHeld = (competition.entryFeesHeld as string) ?? "0";
  if (BigInt(entryFees) !== BigInt(counterHeld)) {
    throw fail(
      `Held entry fees (${entryFees}) do not match entryFeesHeld (${counterHeld})`,
      422,
    );
  }

  const feeBps =
    typeof competition.feeBps === "number" ? competition.feeBps : DEFAULT_FEE_BPS;

  // Refuse rather than pay out of a balance we cannot account for.
  const accounted = BigInt(poolAmount) + BigInt(entryFees);
  if (BigInt(escrowed) !== accounted) {
    throw fail(
      `Escrowed amount (${escrowed}) does not match the prize pool plus entry fees (${accounted})`,
      422,
    );
  }

  const counts = (tallySnapshot.data()?.counts ?? {}) as Record<string, number>;

  // Driven by the submissions list, not the tally's key set — the tally merges
  // a whole map, so withdrawn entrants' keys survive in it.
  const entries = buildRankableEntries(
    submissionsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        submissionId: doc.id,
        userId: (data.userId as string) ?? doc.id,
        status: (data.status as string) ?? "submitted",
        submittedAtMs:
          (data.submittedAt as Timestamp | undefined)?.toMillis?.() ?? 0,
      };
    }),
    counts,
  );

  const ranked = rankEntries(entries);
  const results = computePayouts(ranked, poolAmount);

  const votingClosedAtMs =
    (competition.votingDeadline as Timestamp | undefined)?.toMillis?.() ??
    claim.claimedAtMs;

  const { payload, json } = buildDigestPayload({
    competitionId,
    assetId: (competition.prizePool?.assetId as string) ?? escrow.assetId,
    pool: poolAmount,
    entryFees,
    feeBps,
    votingClosedAtMs,
    results,
  });
  const resultsDigest = createHash("sha256").update(json, "utf8").digest("hex");

  const refunded = results.length === 0;

  if (refunded) {
    // Nobody entered, or nobody voted. Nothing was judged and nothing earned,
    // so everything goes back to source — keeping the fees would charge people
    // for a contest that produced no result.
    const refund = await escrow.refund({
      competitionId,
      refunds: buildUnwindRefunds({
        seedUserId: creatorId,
        seedAmount: assertMinorUnits(poolAmount, "prize pool"),
        held: contributions,
      }),
      mode: "final",
      idempotencyKey: `escrow:refund:competition:${competitionId}`,
    });
    if (refund.state !== "confirmed") {
      throw fail(
        refund.state === "failed"
          ? refund.reason
          : "Refund is still pending confirmation",
        500,
      );
    }
  } else {
    const total = totalPayout(results);
    if (BigInt(total) !== BigInt(poolAmount)) {
      // The core guarantees this; assert anyway, because a mismatch would
      // strand tokens in escrow forever.
      throw fail(
        `Payout total (${total}) does not drain the pool (${poolAmount})`,
        500,
      );
    }

    // The prize is the seed alone — fees are revenue, not winnings.
    const fees = splitEntryFees(entryFees, feeBps);

    const payouts = results
      .filter((result) => BigInt(result.amount) > 0n)
      .map((result) => ({
        userId: result.userId,
        // The core is import-free and so deals in plain strings; re-validate at
        // the boundary rather than casting, which also proves its output is
        // canonical minor units before any of it reaches the ledger.
        amount: assertMinorUnits(result.amount, "payout amount"),
      }));

    if (BigInt(fees.host) > 0n) {
      payouts.push({
        userId: creatorId,
        amount: assertMinorUnits(fees.host, "host fee share"),
      });
    }

    const released = payouts.reduce(
      (sum, payout) => sum + BigInt(payout.amount),
      BigInt(fees.platform),
    );
    if (released !== BigInt(escrowed)) {
      throw fail(
        `Release total (${released}) does not drain escrow (${escrowed})`,
        500,
      );
    }

    const release = await escrow.release({
      competitionId,
      payouts,
      platformFee: assertMinorUnits(fees.platform, "platform fee share"),
      resultsDigest,
      idempotencyKey: `escrow:release:competition:${competitionId}`,
    });

    if (release.state !== "confirmed") {
      // Leave the phase at `settling`: visibly stuck and safe to retry, never
      // a competition that looks settled but never paid.
      throw fail(
        release.state === "failed"
          ? release.reason
          : "Payout is still pending confirmation",
        500,
      );
    }
  }

  // Money has moved. Finish the phase, guarded so a concurrent run cannot
  // write results twice.
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const phase = (snapshot.data()?.phase as CompetitionPhase) ?? "settling";
    if (phase === "settled") return;

    tx.update(ref, {
      phase: "settled" as CompetitionPhase,
      escrowState: refunded ? "refunded" : "released",
      // Escrow is drained either way, so nothing is held any more.
      entryFeesHeld: "0",
      entryFeesSettled: refunded
        ? { platform: "0", host: "0" }
        : splitEntryFees(entryFees, feeBps),
      results,
      resultsDigest,
      // Stored so anyone can recompute the hash. A digest nobody can verify is
      // not provenance.
      resultsDigestPayload: payload,
      settledAt: FieldValue.serverTimestamp(),
      phaseUpdatedAt: FieldValue.serverTimestamp(),
      nextTransitionAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await denormalizeVoteCounts(db, competitionId, results);
  await closeContributions(db, competitionId, contributions, refunded);

  logger.info("Competition settled", {
    competitionId,
    refunded,
    winners: results.filter((r) => BigInt(r.amount) > 0n).length,
    resultsDigest,
  });

  return {
    competitionId,
    phase: "settled",
    results,
    resultsDigest,
    settledNow: true,
    refunded,
  };
}

/**
 * Publish per-entry vote counts for display.
 *
 * Deliberately after the transaction and best-effort: these are a projection of
 * the private tally, not the authority for anything, and keeping them out of
 * the settlement transaction is what keeps it bounded. Clients still cannot
 * write them — submissions remain server-only in firestore.rules.
 */
async function denormalizeVoteCounts(
  db: Firestore,
  competitionId: string,
  results: SettlementResult[],
): Promise<void> {
  if (results.length === 0) return;

  try {
    const batch = db.batch();
    const submissions = db
      .collection("competitions")
      .doc(competitionId)
      .collection("submissions");

    for (const result of results) {
      batch.update(submissions.doc(result.submissionId), {
        voteCount: result.votes,
        finalRank: result.rank,
      });
    }
    await batch.commit();
  } catch (error) {
    // The competition is settled and paid; failing to publish display counts
    // must not turn that into an error the caller retries.
    logger.warn("Failed to denormalize vote counts", { competitionId, error });
  }
}

/**
 * Close out the contribution records once escrow has been drained.
 *
 * Best-effort and outside the transaction, like the vote counts: escrow is
 * already empty, so these are a record rather than an authority. A row left on
 * `held` cannot misdirect money — a settled competition can no longer be
 * cancelled or withdrawn from.
 */
async function closeContributions(
  db: Firestore,
  competitionId: string,
  contributions: Array<{ userId: string }>,
  refunded: boolean,
): Promise<void> {
  if (contributions.length === 0) return;

  try {
    const batch = db.batch();
    const collection = db
      .collection("competitions")
      .doc(competitionId)
      .collection("contributions");

    for (const contribution of contributions) {
      batch.update(collection.doc(contribution.userId), {
        state: refunded ? "refunded" : "settled",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    logger.warn("Failed to close contributions", { competitionId, error });
  }
}
