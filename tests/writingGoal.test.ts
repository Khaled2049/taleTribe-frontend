import { describe, expect, it } from "vitest";
import { countWords, dayKey, recordWords, wordsToday } from "@/lib/writingGoal";

const data = (written: number, day = "2026-10-10") => ({
  goal: 500,
  day,
  written,
});

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("  She paused.\n Not now. ")).toBe(4);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("dayKey", () => {
  it("uses the local calendar day, zero-padded", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("recordWords", () => {
  it("adds to today's total and lets deletions subtract", () => {
    expect(recordWords(data(100), 25, "2026-10-10").written).toBe(125);
    expect(recordWords(data(100), -40, "2026-10-10").written).toBe(60);
  });

  it("starts over on a new day and keeps the goal", () => {
    expect(recordWords(data(480), 10, "2026-10-11")).toEqual({
      goal: 500,
      day: "2026-10-11",
      written: 10,
    });
  });
});

describe("wordsToday", () => {
  it("shows nothing for a stale day or a net-negative one", () => {
    expect(wordsToday(data(300), "2026-10-10")).toBe(300);
    expect(wordsToday(data(300), "2026-10-11")).toBe(0);
    expect(wordsToday(data(-20), "2026-10-10")).toBe(0);
  });
});
