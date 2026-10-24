import { describe, expect, it } from "vitest";
import {
  awaitingSettlementFor,
  canAdminCancel,
  settleDueSummary,
} from "../src/routes/Admin/competitionStatus";

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

describe("settleDueSummary", () => {
  it("says when there was nothing to do", () => {
    expect(settleDueSummary({ settled: [], failed: [] })).toBe(
      "Nothing was waiting to settle.",
    );
  });

  it("counts what settled", () => {
    expect(settleDueSummary({ settled: ["a"], failed: [] })).toBe(
      "Settled 1 competition.",
    );
    expect(settleDueSummary({ settled: ["a", "b"], failed: [] })).toBe(
      "Settled 2 competitions.",
    );
  });

  it("reports failures and where to look", () => {
    expect(settleDueSummary({ settled: ["a"], failed: ["b"] })).toBe(
      "Settled 1 competition. 1 competition could not be settled and is still awaiting settlement; the story-data logs say why.",
    );
    expect(settleDueSummary({ settled: [], failed: ["a", "b"] })).toBe(
      "2 competitions could not be settled and are still awaiting settlement; the story-data logs say why.",
    );
  });
});

describe("canAdminCancel", () => {
  it("offers cancel until a competition settles", () => {
    for (const phase of ["scheduled", "open", "voting"] as const) {
      expect(canAdminCancel(phase)).toBe(true);
    }
  });

  it("never offers it for a draft, which is deleted instead", () => {
    expect(canAdminCancel("draft")).toBe(false);
  });

  it("never offers it once settlement has started or it is over", () => {
    for (const phase of ["settling", "settled", "cancelled"] as const) {
      expect(canAdminCancel(phase)).toBe(false);
    }
  });
});
