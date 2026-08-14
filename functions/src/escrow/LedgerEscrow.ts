/**
 * EscrowProvider backed by the off-chain double-entry ledger.
 *
 * Every operation is a single balanced transfer, so escrow is a real account
 * holder with a real balance rather than a number on the competition document.
 * That is the point of funding prize pools now even though the token is
 * make-believe: the states, the failure modes and the UI all get exercised
 * against the same lifecycle the contract will later implement.
 *
 * This implementation is always synchronous — it never returns `"pending"`,
 * because a Firestore transaction either committed or it did not.
 */
import { Firestore } from "firebase-admin/firestore";
import {
  LEDGER_TRANSFERS,
  LedgerReason,
  PLATFORM_ACCOUNT,
  Posting,
  escrowAccount,
  getBalance,
  transfer,
  userAccount,
} from "../ledger";
import {
  MinorUnits,
  TALE_ASSET_ID,
  TALE_DECIMALS,
  TALE_SYMBOL,
  ZERO,
  isPositive,
} from "../money";
import {
  EscrowOpResult,
  EscrowProvider,
  FundParams,
  RefundParams,
  ReleaseParams,
} from "./EscrowProvider";
import { outstandingTotal, planRefundBatches } from "./refundPlan";

export class LedgerEscrow implements EscrowProvider {
  readonly assetId = TALE_ASSET_ID;
  readonly symbol = TALE_SYMBOL;
  readonly decimals = TALE_DECIMALS;

  constructor(private readonly db: Firestore) {}

  async fund(params: FundParams): Promise<EscrowOpResult> {
    const { competitionId, funderUserId, amount, purpose, idempotencyKey } =
      params;

    if (!isPositive(amount)) {
      return {
        state: "failed",
        opId: idempotencyKey,
        reason:
          purpose === "entry"
            ? "Entry fee must be greater than zero"
            : "Prize amount must be greater than zero",
      };
    }

    const reason: LedgerReason =
      purpose === "entry" ? "escrow:entry" : "escrow:fund";

    try {
      await transfer(this.db, {
        idempotencyKey,
        reason,
        competitionId,
        postings: [
          { accountId: userAccount(funderUserId), delta: -BigInt(amount) },
          { accountId: escrowAccount(competitionId), delta: BigInt(amount) },
        ],
      });
      return { state: "confirmed", opId: idempotencyKey };
    } catch (error) {
      return this.toFailure(idempotencyKey, error);
    }
  }

  async release(params: ReleaseParams): Promise<EscrowOpResult> {
    const { competitionId, payouts, resultsDigest, idempotencyKey } = params;
    const platformFee = BigInt(params.platformFee ?? ZERO);

    if (payouts.length === 0 && platformFee <= 0n) {
      return {
        state: "failed",
        opId: idempotencyKey,
        reason: "No payouts to release",
      };
    }

    // One posting per account, so a user appearing twice must be collapsed
    // before the ledger sees it.
    const byUser = new Map<string, bigint>();
    for (const payout of payouts) {
      byUser.set(
        payout.userId,
        (byUser.get(payout.userId) ?? 0n) + BigInt(payout.amount),
      );
    }

    // The ledger rejects a zero-value posting, and a host whose fee share
    // rounds to nothing is a legitimate outcome rather than an error.
    for (const [userId, amount] of [...byUser.entries()]) {
      if (amount <= 0n) byUser.delete(userId);
    }

    const total =
      [...byUser.values()].reduce((sum, value) => sum + value, 0n) + platformFee;
    if (total <= 0n) {
      return {
        state: "failed",
        opId: idempotencyKey,
        reason: "Total payout must be greater than zero",
      };
    }

    const postings: Posting[] = [
      { accountId: escrowAccount(competitionId), delta: -total },
      ...[...byUser.entries()].map(([userId, amount]) => ({
        accountId: userAccount(userId),
        delta: amount,
      })),
    ];

    if (platformFee > 0n) {
      postings.push({ accountId: PLATFORM_ACCOUNT, delta: platformFee });
    }

    try {
      await transfer(this.db, {
        idempotencyKey,
        reason: "escrow:release",
        competitionId,
        metadata: { resultsDigest },
        postings,
      });
      return { state: "confirmed", opId: idempotencyKey };
    } catch (error) {
      return this.toFailure(idempotencyKey, error);
    }
  }

  /**
   * Return escrow to the funders named, in batches.
   *
   * Each batch is keyed individually, so an interrupted run resumes by
   * replaying every key and skipping those already applied — which is why the
   * balance assertion measures the unapplied portion, not the full total.
   */
  async refund(params: RefundParams): Promise<EscrowOpResult> {
    const { competitionId, refunds, mode, idempotencyKey } = params;
    const escrowed = await this.escrowedAmount(competitionId);

    if (!isPositive(escrowed)) {
      // Nothing held: an unfunded or already-refunded competition. Treat as
      // success so cancelling twice is safe.
      return { state: "confirmed", opId: idempotencyKey };
    }

    const batches = planRefundBatches(refunds);

    if (batches.length === 0) {
      return {
        state: "failed",
        opId: idempotencyKey,
        reason: "A refund must name at least one funder",
      };
    }

    const keyOf = (index: number): string =>
      batches.length === 1 ? idempotencyKey : `${idempotencyKey}:${index}`;

    const applied = await Promise.all(
      batches.map((batch) =>
        this.db.collection(LEDGER_TRANSFERS).doc(keyOf(batch.index)).get(),
      ),
    );

    const outstanding = BigInt(
      outstandingTotal(batches, (index) => applied[index].exists),
    );

    if (mode === "final" && outstanding !== BigInt(escrowed)) {
      // Refuse rather than strand tokens in an account nothing else reads.
      return {
        state: "failed",
        opId: idempotencyKey,
        reason: `Refunds (${outstanding}) do not drain the escrowed balance (${escrowed})`,
      };
    }

    if (mode === "partial" && outstanding > BigInt(escrowed)) {
      return {
        state: "failed",
        opId: idempotencyKey,
        reason: `Refunds (${outstanding}) exceed the escrowed balance (${escrowed})`,
      };
    }

    // A final unwind returns the host's seed too, so it is not purely an entry
    // refund; a partial one always is.
    const reason: LedgerReason =
      mode === "final" ? "escrow:refund" : "escrow:entry-refund";

    try {
      for (const batch of batches) {
        if (applied[batch.index].exists) continue;

        await transfer(this.db, {
          idempotencyKey: keyOf(batch.index),
          reason,
          competitionId,
          postings: [
            {
              accountId: escrowAccount(competitionId),
              delta: -BigInt(batch.subtotal),
            },
            ...batch.refunds.map((refund) => ({
              accountId: userAccount(refund.userId),
              delta: BigInt(refund.amount),
            })),
          ],
        });
      }
      return { state: "confirmed", opId: idempotencyKey };
    } catch (error) {
      return this.toFailure(idempotencyKey, error);
    }
  }

  async escrowedAmount(competitionId: string): Promise<MinorUnits> {
    return getBalance(this.db, escrowAccount(competitionId));
  }

  async spendableBalance(userId: string): Promise<MinorUnits> {
    return getBalance(this.db, userAccount(userId));
  }

  /**
   * For the ledger, an operation exists exactly when its transfer document
   * does — the idempotency key is that document's id.
   */
  async getOperation(opId: string): Promise<EscrowOpResult> {
    const snapshot = await this.db.collection(LEDGER_TRANSFERS).doc(opId).get();
    return snapshot.exists
      ? { state: "confirmed", opId }
      : { state: "failed", opId, reason: "No such escrow operation" };
  }

  /**
   * Insufficient funds is an expected outcome, not a crash — surface it as a
   * failed operation so callers handle funding failure on one path regardless
   * of which provider is active.
   */
  private toFailure(opId: string, error: unknown): EscrowOpResult {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 402) {
      return { state: "failed", opId, reason: "Insufficient token balance" };
    }
    throw error;
  }
}

export const EMPTY_BALANCE = ZERO;
