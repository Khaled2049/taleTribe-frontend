import { describe, expect, it } from "vitest";
import {
  REFUND_BATCH_SIZE,
  outstandingTotal,
  plannedTotal,
  planRefundBatches,
} from "../functions/src/escrow/refundPlan";

const TALE = (whole: number): string => (BigInt(whole) * 10n ** 18n).toString();

const funders = (count: number, amount: string) =>
  Array.from({ length: count }, (_, i) => ({
    userId: `user_${i}`,
    amount,
  }));

const none = () => false;

describe("planRefundBatches", () => {
  it("returns nothing for an empty refund list", () => {
    expect(planRefundBatches([])).toEqual([]);
  });

  it("keeps a small refund in one batch", () => {
    const batches = planRefundBatches(funders(3, TALE(25)));
    expect(batches).toHaveLength(1);
    expect(batches[0].index).toBe(0);
    expect(batches[0].refunds).toHaveLength(3);
    expect(batches[0].subtotal).toBe(TALE(75));
  });

  /** The reason batching exists: one transfer would exceed the 500-write cap. */
  it("splits a full competition below the Firestore write cap", () => {
    const batches = planRefundBatches(funders(500, TALE(25)));
    expect(batches).toHaveLength(2);
    expect(batches[0].refunds).toHaveLength(REFUND_BATCH_SIZE);
    expect(batches[1].refunds).toHaveLength(500 - REFUND_BATCH_SIZE);
    // One account document per funder, plus the transfer and escrow postings.
    expect(batches[0].refunds.length + 2).toBeLessThanOrEqual(500);
  });

  it("loses nothing across a split", () => {
    const batches = planRefundBatches(funders(500, TALE(25)));
    expect(plannedTotal(batches)).toBe(TALE(12500));
  });

  it("numbers batches consecutively from zero, for stable idempotency keys", () => {
    const batches = planRefundBatches(funders(1000, TALE(1)), 400);
    expect(batches.map((b) => b.index)).toEqual([0, 1, 2]);
  });

  /** The ledger rejects a transfer naming the same account twice. */
  it("collapses a funder who appears more than once", () => {
    const batches = planRefundBatches([
      { userId: "a", amount: TALE(25) },
      { userId: "b", amount: TALE(25) },
      { userId: "a", amount: TALE(100) },
    ]);
    expect(batches[0].refunds).toEqual([
      { userId: "a", amount: TALE(125) },
      { userId: "b", amount: TALE(25) },
    ]);
    expect(batches[0].subtotal).toBe(TALE(150));
  });

  /** A zero-delta posting is rejected by the ledger; a zero refund is a no-op. */
  it("drops zero and cancelling amounts rather than emitting them", () => {
    const batches = planRefundBatches([
      { userId: "a", amount: "0" },
      { userId: "b", amount: TALE(25) },
    ]);
    expect(batches[0].refunds).toEqual([{ userId: "b", amount: TALE(25) }]);
  });

  it("returns no batches when everything collapses to zero", () => {
    expect(planRefundBatches([{ userId: "a", amount: "0" }])).toEqual([]);
  });

  it("is deterministic, so a retry rebuilds the same batches", () => {
    const input = funders(900, TALE(3));
    expect(planRefundBatches(input)).toEqual(planRefundBatches(input));
  });

  it("handles amounts far past Number.MAX_SAFE_INTEGER", () => {
    const huge = "123456789012345678901234567890";
    const batches = planRefundBatches([
      { userId: "a", amount: huge },
      { userId: "b", amount: huge },
    ]);
    expect(batches[0].subtotal).toBe("246913578024691357802469135780");
  });

  it("rejects a nonsensical batch size", () => {
    expect(() => planRefundBatches(funders(2, TALE(1)), 0)).toThrow();
  });
});

describe("outstandingTotal", () => {
  it("is the whole plan when nothing has been applied", () => {
    const batches = planRefundBatches(funders(500, TALE(25)));
    expect(outstandingTotal(batches, none)).toBe(TALE(12500));
  });

  /** What the drains-to-zero assertion depends on when resuming a partial run. */
  it("excludes batches the ledger already applied", () => {
    const batches = planRefundBatches(funders(500, TALE(25)));
    const outstanding = outstandingTotal(batches, (index) => index === 0);
    expect(outstanding).toBe(TALE(2500)); // the 100 funders in batch 1
  });

  it("is zero once every batch has landed", () => {
    const batches = planRefundBatches(funders(500, TALE(25)));
    expect(outstandingTotal(batches, () => true)).toBe("0");
  });

  it("is zero for an empty plan", () => {
    expect(outstandingTotal([], none)).toBe("0");
  });
});
