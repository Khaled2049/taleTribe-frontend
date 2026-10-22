import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUid, parseSort, parseUsageRange, usageFlags } from "../src/domain/aiUsage";

describe("parseUsageRange", () => {
  it("accepts no range, or YYYY-MM-DD days", () => {
    assert.deepEqual(parseUsageRange({}), {});
    assert.deepEqual(parseUsageRange({ from: "2026-10-01", to: "2026-10-22" }), {
      from: "2026-10-01",
      to: "2026-10-22",
    });
    assert.deepEqual(parseUsageRange({ from: "" }), {});
  });

  it("refuses anything that could smuggle extra query text", () => {
    assert.equal(parseUsageRange({ from: "2026-10-01&user_id=x" }), null);
    assert.equal(parseUsageRange({ to: ["2026-10-01"] }), null);
    assert.equal(parseUsageRange({ from: "10/01/2026" }), null);
  });
});

describe("usageFlags", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const base = { heavyDays: 0, mostPurchasesInADay: 0, rank: 0, accountCreatedAt: new Date("2026-01-01T00:00:00Z") };

  it("flags nothing for an ordinary heavy user", () => {
    assert.deepEqual(usageFlags({ ...base, heavyDays: 2, mostPurchasesInADay: 2 }, now), []);
  });

  it("flags repeated daily-limit days and maxed-out top-ups", () => {
    assert.deepEqual(usageFlags({ ...base, heavyDays: 3, mostPurchasesInADay: 3 }, now), [
      "at_daily_limit",
      "max_top_ups",
    ]);
  });

  it("flags a new account only near the top of the list", () => {
    const fresh = new Date("2026-10-20T12:00:00Z");
    assert.deepEqual(usageFlags({ ...base, accountCreatedAt: fresh, rank: 9 }, now), ["new_account"]);
    assert.deepEqual(usageFlags({ ...base, accountCreatedAt: fresh, rank: 10 }, now), []);
    assert.deepEqual(usageFlags({ ...base, accountCreatedAt: null }, now), []);
  });
});

describe("parseSort and isUid", () => {
  it("defaults the sort to credits and refuses other values", () => {
    assert.equal(parseSort(undefined), "credits");
    assert.equal(parseSort("requests"), "requests");
    assert.equal(parseSort("tokens"), null);
  });

  it("accepts Firebase-style uids and nothing path-like", () => {
    assert.ok(isUid("aB3_x-9"));
    assert.ok(!isUid("a/b"));
    assert.ok(!isUid("../x"));
    assert.ok(!isUid("x".repeat(129)));
    assert.ok(!isUid(""));
  });
});
