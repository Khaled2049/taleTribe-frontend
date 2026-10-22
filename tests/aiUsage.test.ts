import { describe, expect, it } from "vitest";
import {
  labelledDays,
  meterLevel,
  niceTicks,
  projectToMidnight,
  summarize,
  utcRange,
  type UsageDay,
} from "../src/lib/aiUsage";

const day = (overrides: Partial<UsageDay>): UsageDay => ({
  day: "2026-10-20",
  platformRequests: 0,
  byokRequests: 0,
  failedRequests: 0,
  unknownUsageRequests: 0,
  credits: 0,
  promptTokens: 0,
  completionTokens: 0,
  purchasedCredits: 0,
  activeUsers: 0,
  ...overrides,
});

describe("utcRange", () => {
  it("ends on today's UTC date, whatever the local time zone", () => {
    expect(utcRange(30, new Date("2026-10-22T23:30:00-07:00"))).toEqual({
      from: "2026-09-24",
      to: "2026-10-23",
    });
    expect(utcRange(1, new Date("2026-10-22T00:00:00Z"))).toEqual({
      from: "2026-10-22",
      to: "2026-10-22",
    });
  });
});

describe("projectToMidnight", () => {
  it("extrapolates the pace so far to the end of the UTC day", () => {
    expect(projectToMidnight(300, new Date("2026-10-22T06:00:00Z"))).toBe(1200);
  });

  it("declines to project from the first minutes of the day", () => {
    expect(projectToMidnight(4, new Date("2026-10-22T00:30:00Z"))).toBeNull();
  });
});

describe("meterLevel", () => {
  it("warns from 80% and is critical at the cap", () => {
    expect(meterLevel(1119, 1400)).toBe("normal");
    expect(meterLevel(1120, 1400)).toBe("warning");
    expect(meterLevel(1400, 1400)).toBe("critical");
    expect(meterLevel(0, 0)).toBe("critical");
  });
});

describe("summarize", () => {
  it("totals the range and rates failures against platform requests only", () => {
    const totals = summarize([
      day({
        platformRequests: 8,
        byokRequests: 5,
        failedRequests: 2,
        credits: 40,
        promptTokens: 300,
        completionTokens: 100,
      }),
      day({
        platformRequests: 2,
        purchasedCredits: 10000,
        unknownUsageRequests: 1,
      }),
    ]);
    expect(totals).toMatchObject({
      platformRequests: 10,
      byokRequests: 5,
      credits: 40,
      tokens: 400,
      purchasedCredits: 10000,
      unknownUsageRequests: 1,
      failureRate: 0.2,
    });
    expect(summarize([day({ byokRequests: 3 })]).failureRate).toBeNull();
  });
});

describe("niceTicks", () => {
  it("steps by 1, 2 or 5 and always reaches the maximum", () => {
    expect(niceTicks(37)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(1400)).toEqual([0, 500, 1000, 1500]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe("labelledDays", () => {
  it("always labels the latest day and keeps about six labels", () => {
    expect([...labelledDays(7)].sort((a, b) => a - b)).toEqual(
      [0, 1, 2, 3, 4, 5, 6].filter((i) => (6 - i) % 2 === 0),
    );
    expect(labelledDays(90).size).toBeLessThanOrEqual(6);
    expect(labelledDays(90).has(89)).toBe(true);
  });
});
