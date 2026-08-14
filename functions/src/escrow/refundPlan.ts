/**
 * How a multi-funder refund is broken into ledger transfers.
 *
 * Zero imports, like competitionSettlementCore.ts, so vitest can test it
 * directly. Amounts are minor-unit strings; arithmetic is BigInt.
 */

/**
 * `transfer` writes one document per posting inside one Firestore transaction,
 * which caps at 500. A competition holds up to 500 entries, so a full refund
 * must be split; 400 funders is 402 writes.
 */
export const REFUND_BATCH_SIZE = 400;

export interface RefundInput {
  userId: string;
  amount: string;
}

export interface RefundBatch {
  /** Position in the plan. Feeds the per-batch idempotency key. */
  index: number;
  refunds: RefundInput[];
  subtotal: string;
}

/**
 * Group refunds into transfer-sized batches.
 *
 * Duplicate users are collapsed and non-positive amounts dropped, because the
 * ledger rejects both a repeated account and a zero delta. Ordering is stable
 * so a retry rebuilds the same batches — otherwise an already-applied
 * idempotency key would cover a different set of people.
 */
export function planRefundBatches(
  refunds: RefundInput[],
  batchSize: number = REFUND_BATCH_SIZE,
): RefundBatch[] {
  if (batchSize < 1) {
    throw new Error(`planRefundBatches: batchSize must be at least 1, got ${batchSize}`);
  }

  const byUser = new Map<string, bigint>();
  for (const refund of refunds) {
    const amount = BigInt(refund.amount);
    byUser.set(refund.userId, (byUser.get(refund.userId) ?? 0n) + amount);
  }

  const owed = [...byUser.entries()].filter(([, amount]) => amount > 0n);

  const batches: RefundBatch[] = [];
  for (let i = 0; i < owed.length; i += batchSize) {
    const slice = owed.slice(i, i + batchSize);
    batches.push({
      index: batches.length,
      refunds: slice.map(([userId, amount]) => ({
        userId,
        amount: amount.toString(),
      })),
      subtotal: slice.reduce((sum, [, amount]) => sum + amount, 0n).toString(),
    });
  }

  return batches;
}

/**
 * What the plan still owes, skipping batches already applied.
 *
 * A half-finished refund leaves escrow partly drained, so checking the full
 * total against the balance would reject a retry that is proceeding correctly.
 */
export function outstandingTotal(
  batches: RefundBatch[],
  isApplied: (index: number) => boolean,
): string {
  return batches
    .reduce(
      (sum, batch) => (isApplied(batch.index) ? sum : sum + BigInt(batch.subtotal)),
      0n,
    )
    .toString();
}

/** Total of an entire plan, applied or not. */
export function plannedTotal(batches: RefundBatch[]): string {
  return batches
    .reduce((sum, batch) => sum + BigInt(batch.subtotal), 0n)
    .toString();
}
