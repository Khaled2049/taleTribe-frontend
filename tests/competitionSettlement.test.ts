import { describe, expect, it } from "vitest";
import {
  buildDigestPayload,
  buildRankableEntries,
  computePayouts,
  rankEntries,
  splitEntryFees,
  totalPayout,
  type RankableEntry,
} from "../functions/src/competitionSettlementCore";

const POOL = "100000000000000000000"; // 100 TALE

const entry = (
  submissionId: string,
  votes: number,
  submittedAtMs: number,
): RankableEntry => ({ submissionId, userId: submissionId, votes, submittedAtMs });

describe("rankEntries", () => {
  it("orders by votes, descending", () => {
    const ranked = rankEntries([entry("a", 1, 100), entry("b", 5, 100), entry("c", 3, 100)]);
    expect(ranked.map((e) => e.submissionId)).toEqual(["b", "c", "a"]);
  });

  it("breaks a vote tie with the earlier submission", () => {
    const ranked = rankEntries([entry("late", 3, 500), entry("early", 3, 100)]);
    expect(ranked[0].submissionId).toBe("early");
  });

  it("breaks a full tie lexicographically, so the order is total", () => {
    // Arbitrary, but required: without it the digest is not reproducible.
    const ranked = rankEntries([entry("zebra", 3, 100), entry("alpha", 3, 100)]);
    expect(ranked.map((e) => e.submissionId)).toEqual(["alpha", "zebra"]);
  });

  it("produces the same order regardless of input order", () => {
    const a = entry("a", 3, 100);
    const b = entry("b", 3, 100);
    const c = entry("c", 5, 200);
    const one = rankEntries([a, b, c]).map((e) => e.submissionId);
    const two = rankEntries([c, b, a]).map((e) => e.submissionId);
    const three = rankEntries([b, c, a]).map((e) => e.submissionId);
    expect(one).toEqual(two);
    expect(two).toEqual(three);
  });

  it("does not mutate its input", () => {
    const input = [entry("a", 1, 100), entry("b", 9, 100)];
    rankEntries(input);
    expect(input.map((e) => e.submissionId)).toEqual(["a", "b"]);
  });

  it("handles an empty list", () => {
    expect(rankEntries([])).toEqual([]);
  });
});

describe("computePayouts", () => {
  it("pays the entire pool to rank 1", () => {
    const results = computePayouts(rankEntries([entry("a", 5, 1), entry("b", 2, 1)]), POOL);
    expect(results[0]).toMatchObject({ rank: 1, submissionId: "a", amount: POOL });
    expect(results[1]).toMatchObject({ rank: 2, submissionId: "b", amount: "0" });
  });

  it("drains the pool exactly — nothing is stranded in escrow", () => {
    const results = computePayouts(rankEntries([entry("a", 5, 1), entry("b", 3, 1)]), POOL);
    expect(totalPayout(results)).toBe(POOL);
  });

  it("records every ranked entry, not just the winner", () => {
    const results = computePayouts(
      rankEntries([entry("a", 5, 1), entry("b", 3, 1), entry("c", 1, 1)]),
      POOL,
    );
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("pays nobody when there are no entries", () => {
    expect(computePayouts([], POOL)).toEqual([]);
  });

  it("pays nobody when no entry received a vote", () => {
    // Awarding on submission time alone would be a prize with no community
    // signal behind it — the caller refunds the creator instead.
    const results = computePayouts(rankEntries([entry("a", 0, 1), entry("b", 0, 2)]), POOL);
    expect(results).toEqual([]);
  });

  it("pays nobody from an empty pool", () => {
    expect(computePayouts(rankEntries([entry("a", 5, 1)]), "0")).toEqual([]);
  });

  it("is exact at amounts far beyond 2^53", () => {
    const huge = "123456789012345678901234567890";
    const results = computePayouts(rankEntries([entry("a", 1, 1)]), huge);
    expect(results[0].amount).toBe(huge);
    expect(totalPayout(results)).toBe(huge);
  });
});

describe("buildRankableEntries", () => {
  const submissions = [
    { submissionId: "a", userId: "a", status: "submitted", submittedAtMs: 100 },
    { submissionId: "b", userId: "b", status: "withdrawn", submittedAtMs: 200 },
    { submissionId: "c", userId: "c", status: "submitted", submittedAtMs: 300 },
  ];

  it("excludes withdrawn entries even when the tally still counts them", () => {
    // The tally merges a whole map, so a withdrawn entrant's key survives in
    // it. Trusting the tally's keys would pay somebody who pulled out.
    const entries = buildRankableEntries(submissions, { a: 1, b: 99, c: 2 });
    expect(entries.map((e) => e.submissionId)).toEqual(["a", "c"]);
    const ranked = rankEntries(entries);
    expect(ranked[0].submissionId).toBe("c");
  });

  it("treats a missing tally key as zero votes", () => {
    const entries = buildRankableEntries(submissions, {});
    expect(entries.every((e) => e.votes === 0)).toBe(true);
  });

  it("clamps a negative count to zero", () => {
    const entries = buildRankableEntries(submissions, { a: -5 });
    expect(entries.find((e) => e.submissionId === "a")?.votes).toBe(0);
  });

  it("excludes disqualified entries", () => {
    const entries = buildRankableEntries(
      [{ submissionId: "x", userId: "x", status: "disqualified", submittedAtMs: 1 }],
      { x: 10 },
    );
    expect(entries).toEqual([]);
  });
});

describe("splitEntryFees", () => {
  /** Asserts the two shares re-sum to the input, so escrow drains to zero. */
  const sums = (feesHeld: string, feeBps: number) => {
    const { platform, host } = splitEntryFees(feesHeld, feeBps);
    expect((BigInt(platform) + BigInt(host)).toString()).toBe(feesHeld);
    return { platform, host };
  };

  it("takes the configured basis points for the platform", () => {
    // 100 TALE at 10%
    expect(sums(POOL, 1000)).toEqual({
      platform: "10000000000000000000",
      host: "90000000000000000000",
    });
  });

  it("gives everything to the host at 0 bps", () => {
    expect(sums(POOL, 0)).toEqual({ platform: "0", host: POOL });
  });

  it("honours the 30% ceiling TippingPlatform uses", () => {
    expect(sums(POOL, 3000)).toEqual({
      platform: "30000000000000000000",
      host: "70000000000000000000",
    });
  });

  it("floors the platform share, so the remainder falls to the host", () => {
    // 7 wei at 10% is 0.7 -> 0, and the host must receive all 7.
    expect(sums("7", 1000)).toEqual({ platform: "0", host: "7" });
  });

  it("strands nothing on an awkward rate", () => {
    // 333 bps of 1000 wei is 33.3 -> 33.
    expect(sums("1000", 333)).toEqual({ platform: "33", host: "967" });
  });

  it("is zero on both sides when no fees were collected", () => {
    expect(splitEntryFees("0", 1000)).toEqual({ platform: "0", host: "0" });
  });

  it("rejects a rate outside the basis-point range", () => {
    expect(() => splitEntryFees(POOL, -1)).toThrow();
    expect(() => splitEntryFees(POOL, 10001)).toThrow();
    expect(() => splitEntryFees(POOL, 12.5)).toThrow();
  });
});

describe("buildDigestPayload", () => {
  const base = {
    competitionId: "comp_1",
    assetId: "TALE",
    pool: POOL,
    entryFees: "0",
    feeBps: 1000,
    votingClosedAtMs: 1_700_000_000_000,
  };

  const results = computePayouts(
    rankEntries([entry("a", 5, 1), entry("b", 3, 2)]),
    POOL,
  );

  it("serializes with a fixed key order", () => {
    const { json } = buildDigestPayload({ ...base, results });
    expect(json.startsWith('{"v":2,"competitionId":"comp_1","assetId":"TALE"')).toBe(true);
  });

  it("emits no whitespace", () => {
    const { json } = buildDigestPayload({ ...base, results });
    expect(json).not.toMatch(/\n|\s{2}/);
  });

  it("is stable regardless of the order results are passed in", () => {
    const forward = buildDigestPayload({ ...base, results }).json;
    const reversed = buildDigestPayload({ ...base, results: [...results].reverse() }).json;
    expect(forward).toBe(reversed);
  });

  it("changes when any amount moves by a single wei", () => {
    const original = buildDigestPayload({ ...base, results }).json;
    const nudged = buildDigestPayload({
      ...base,
      results: results.map((r, i) =>
        i === 0 ? { ...r, amount: (BigInt(r.amount) - 1n).toString() } : r,
      ),
    }).json;
    expect(nudged).not.toBe(original);
  });

  it("changes when the vote count changes", () => {
    const original = buildDigestPayload({ ...base, results }).json;
    const nudged = buildDigestPayload({
      ...base,
      results: results.map((r, i) => (i === 0 ? { ...r, votes: r.votes + 1 } : r)),
    }).json;
    expect(nudged).not.toBe(original);
  });

  it("round-trips to an equivalent object", () => {
    const { payload, json } = buildDigestPayload({ ...base, results });
    expect(JSON.parse(json)).toEqual(payload);
  });

  it("handles an empty result set (nobody won)", () => {
    const { payload, json } = buildDigestPayload({ ...base, results: [] });
    expect(payload.results).toEqual([]);
    expect(JSON.parse(json).results).toEqual([]);
  });

  it("changes when the entry fees collected change", () => {
    const free = buildDigestPayload({ ...base, results }).json;
    const paid = buildDigestPayload({
      ...base,
      entryFees: "25000000000000000000",
      results,
    }).json;
    expect(paid).not.toBe(free);
  });

  it("changes when the split rate changes", () => {
    const original = buildDigestPayload({
      ...base,
      entryFees: "25000000000000000000",
      results,
    }).json;
    const rerated = buildDigestPayload({
      ...base,
      entryFees: "25000000000000000000",
      feeBps: 2000,
      results,
    }).json;
    expect(rerated).not.toBe(original);
  });
});
