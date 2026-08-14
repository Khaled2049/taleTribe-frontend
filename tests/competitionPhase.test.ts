import { describe, expect, it } from "vitest";
import {
  canTransition,
  deriveCompetitionStatus,
  deriveStatusFromDates,
  dueTimePhase,
  isTerminalPhase,
  nextTransitionAt,
} from "../src/lib/competitionPhase";
import type { CompetitionPhase } from "../src/types/ICompetition";

const NOW = Date.parse("2026-06-15T12:00:00.000Z");
const past = (days: number) => new Date(NOW - days * 86_400_000);
const future = (days: number) => new Date(NOW + days * 86_400_000);

describe("deriveStatusFromDates (legacy behaviour)", () => {
  it("reproduces the original date-only derivation", () => {
    expect(deriveStatusFromDates(future(1), future(5), NOW)).toBe("upcoming");
    expect(deriveStatusFromDates(past(1), future(5), NOW)).toBe("active");
    expect(deriveStatusFromDates(past(5), past(1), NOW)).toBe("completed");
  });

  it("treats the exact start instant as started, not upcoming", () => {
    expect(deriveStatusFromDates(new Date(NOW), future(5), NOW)).toBe("active");
  });

  it("treats the exact deadline instant as still active", () => {
    // The original used `now > deadline`, so the deadline moment is inclusive.
    expect(deriveStatusFromDates(past(1), new Date(NOW), NOW)).toBe("active");
  });
});

describe("deriveCompetitionStatus", () => {
  it("falls back to dates when phase is absent (every legacy document)", () => {
    expect(deriveCompetitionStatus(undefined, future(1), future(5), NOW)).toBe(
      "upcoming",
    );
    expect(deriveCompetitionStatus(undefined, past(1), future(5), NOW)).toBe(
      "active",
    );
    expect(deriveCompetitionStatus(undefined, past(5), past(1), NOW)).toBe(
      "completed",
    );
  });

  it("maps every phase to one of the three UI buckets", () => {
    const cases: Array<[CompetitionPhase, string]> = [
      ["draft", "upcoming"],
      ["scheduled", "upcoming"],
      ["open", "active"],
      ["voting", "active"],
      // Not "completed": voting is over but nothing is decided or paid yet.
      ["settling", "active"],
      ["settled", "completed"],
      ["cancelled", "completed"],
    ];
    for (const [phase, expected] of cases) {
      expect(deriveCompetitionStatus(phase, past(1), future(5), NOW)).toBe(
        expected,
      );
    }
  });

  it("lets a stored phase override the dates", () => {
    // Dates say completed; the phase says voting is still open. Phase wins,
    // otherwise a competition would vanish from the Active tab mid-vote.
    expect(deriveCompetitionStatus("voting", past(10), past(1), NOW)).toBe(
      "active",
    );
    // Dates say active; the competition was cancelled early.
    expect(deriveCompetitionStatus("cancelled", past(1), future(5), NOW)).toBe(
      "completed",
    );
  });

  it("never returns a value outside the three the UI knows", () => {
    const phases: Array<CompetitionPhase | undefined> = [
      "draft",
      "scheduled",
      "open",
      "voting",
      "settling",
      "settled",
      "cancelled",
      undefined,
    ];
    for (const phase of phases) {
      expect(["upcoming", "active", "completed"]).toContain(
        deriveCompetitionStatus(phase, past(1), future(1), NOW),
      );
    }
  });
});

describe("canTransition", () => {
  it("allows the forward path", () => {
    expect(canTransition("draft", "scheduled")).toBe(true);
    expect(canTransition("scheduled", "open")).toBe(true);
    expect(canTransition("open", "voting")).toBe(true);
    expect(canTransition("voting", "settling")).toBe(true);
    expect(canTransition("settling", "settled")).toBe(true);
  });

  /** Publishing something whose start date has already passed opens it now. */
  it("lets a draft open directly, skipping scheduled", () => {
    expect(canTransition("draft", "open")).toBe(true);
  });

  it("allows cancelling from any phase before settlement is claimed", () => {
    expect(canTransition("draft", "cancelled")).toBe(true);
    expect(canTransition("scheduled", "cancelled")).toBe(true);
    expect(canTransition("open", "cancelled")).toBe(true);
    expect(canTransition("voting", "cancelled")).toBe(true);
  });

  it("refuses to cancel once settlement has claimed the competition", () => {
    // Money may already have moved; cancelling would race the payout.
    expect(canTransition("settling", "cancelled")).toBe(false);
  });

  it("refuses to settle without passing through settling", () => {
    // Skipping the claim would let votes change under an in-flight payout.
    expect(canTransition("voting", "settled")).toBe(false);
  });

  it("refuses to move backwards", () => {
    expect(canTransition("voting", "open")).toBe(false);
    expect(canTransition("open", "draft")).toBe(false);
    expect(canTransition("settled", "voting")).toBe(false);
  });

  it("refuses to skip a phase", () => {
    // Skipping straight to settled would pay out with no voting window.
    expect(canTransition("open", "settled")).toBe(false);
    expect(canTransition("open", "settling")).toBe(false);
    expect(canTransition("draft", "voting")).toBe(false);
  });

  it("treats terminal phases as terminal", () => {
    expect(canTransition("settled", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "open")).toBe(false);
    expect(isTerminalPhase("settled")).toBe(true);
    expect(isTerminalPhase("cancelled")).toBe(true);
    expect(isTerminalPhase("open")).toBe(false);
    expect(isTerminalPhase(undefined)).toBe(false);
  });
});

describe("dueTimePhase", () => {
  it("opens a scheduled competition once the start date passes", () => {
    expect(dueTimePhase("scheduled", past(1), future(5), NOW)).toBe("open");
    expect(dueTimePhase("scheduled", future(1), future(5), NOW)).toBeNull();
  });

  /**
   * The property the whole draft phase exists for. An unpublished competition
   * holds no escrow and nobody has seen it, so no date may open it — only
   * publishing can. If this ever regresses, a host's private work goes live on
   * its own and their balance is debited without them asking.
   */
  it("NEVER advances a draft, whatever the clock says", () => {
    expect(dueTimePhase("draft", past(100), past(50), NOW)).toBeNull();
    expect(dueTimePhase("draft", past(1), future(5), NOW)).toBeNull();
    expect(dueTimePhase("draft", future(1), future(5), NOW)).toBeNull();
  });

  it("moves an open competition to voting after the deadline", () => {
    expect(dueTimePhase("open", past(10), past(1), NOW)).toBe("voting");
    expect(dueTimePhase("open", past(10), future(1), NOW)).toBeNull();
  });

  it("never settles on the clock alone", () => {
    // Settlement moves money, so it is claimed by settleCompetition, never by
    // elapsed time. The clock only schedules the attempt.
    expect(dueTimePhase("voting", past(10), past(5), NOW)).toBeNull();
    expect(dueTimePhase("settling", past(10), past(5), NOW)).toBeNull();
  });

  it("has nothing due for terminal phases", () => {
    expect(dueTimePhase("settled", past(10), past(5), NOW)).toBeNull();
    expect(dueTimePhase("cancelled", past(10), past(5), NOW)).toBeNull();
  });
});

describe("nextTransitionAt", () => {
  it("points at the next time-driven boundary", () => {
    const start = future(1);
    const deadline = future(5);
    const voting = future(8);
    expect(nextTransitionAt("scheduled", start, deadline, voting)).toBe(start);
    expect(nextTransitionAt("open", start, deadline, voting)).toBe(deadline);
    expect(nextTransitionAt("voting", start, deadline, voting)).toBe(voting);
  });

  it("has nothing scheduled for a draft", () => {
    // Nothing about an unpublished competition is time-driven, so no advance
    // task is ever enqueued for one.
    expect(nextTransitionAt("draft", future(1), future(5), future(8))).toBeNull();
  });

  it("is null when nothing further is time-driven", () => {
    expect(nextTransitionAt("settled", past(5), past(1))).toBeNull();
    expect(nextTransitionAt("cancelled", past(5), past(1))).toBeNull();
    // A legacy document with no voting deadline.
    expect(nextTransitionAt("voting", past(5), past(1), undefined)).toBeNull();
  });
});
