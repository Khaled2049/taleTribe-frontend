import { describe, expect, it } from "vitest";
import { awaitingSettlementFor } from "../src/routes/Admin/competitionStatus";

const NOW = Date.parse("2026-06-15T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 60 * 60 * 1000;

describe("awaitingSettlementFor", () => {
  it("flags a competition still in voting past its voting deadline", () => {
    expect(awaitingSettlementFor("voting", ago(0), NOW)).toBe("under an hour");
    expect(awaitingSettlementFor("voting", ago(HOUR), NOW)).toBe("1 hour");
    expect(awaitingSettlementFor("voting", ago(47 * HOUR), NOW)).toBe(
      "47 hours",
    );
    expect(awaitingSettlementFor("voting", ago(72 * HOUR), NOW)).toBe("3 days");
  });

  it("does not flag voting that is still open", () => {
    expect(awaitingSettlementFor("voting", ago(-1), NOW)).toBeNull();
  });

  it("does not flag any other phase, whatever the clock says", () => {
    for (const phase of ["open", "settling", "settled", "cancelled"] as const) {
      expect(awaitingSettlementFor(phase, ago(72 * HOUR), NOW)).toBeNull();
    }
  });

  it("does not flag a competition with no voting deadline", () => {
    expect(awaitingSettlementFor("voting", null, NOW)).toBeNull();
  });
});
