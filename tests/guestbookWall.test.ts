import { afterEach, describe, expect, it, vi } from "vitest";
import { dayLabel, feedView, groupByDay } from "@/lib/guestbookWall";

const now = new Date(2026, 9, 3, 15, 0);
const at = (day: number, hour: number) => ({
  createdAt: new Date(2026, 9, day, hour),
});

afterEach(() => vi.restoreAllMocks());

describe("guestbook wall day grouping", () => {
  it("labels today and yesterday relative to the supplied clock", () => {
    expect(dayLabel(new Date(2026, 9, 3, 0, 1), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 2, 23, 59), now)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 9, 1, 12), now)).not.toMatch(
      /Today|Yesterday/,
    );
  });

  it("opens each day with one divider", () => {
    const rows = groupByDay(
      [at(3, 14), at(3, 9), at(2, 22), at(1, 8), at(1, 7)],
      now,
    );
    expect(rows.map((row) => (row.isDivider ? row.label : "·"))).toEqual([
      "Today",
      "·",
      "·",
      "Yesterday",
      "·",
      expect.any(String),
      "·",
      "·",
    ]);
  });

  it("formats a date once per day, not once per entry", () => {
    const format = vi.spyOn(Date.prototype, "toLocaleDateString");
    groupByDay([at(1, 9), at(1, 8), at(1, 7), at(1, 6)], now);
    expect(format).toHaveBeenCalledTimes(1);
  });

  it("re-labels the same entries once the day has turned", () => {
    const entries = [at(3, 14)];
    expect(groupByDay(entries, now)[0]).toMatchObject({ label: "Today" });
    expect(groupByDay(entries, new Date(2026, 9, 4, 0, 5))[0]).toMatchObject({
      label: "Yesterday",
    });
  });
});

describe("guestbook feed view", () => {
  it("shows placeholders until there is data or a failure", () => {
    expect(feedView({ hasData: false, isError: false, count: 0 })).toBe(
      "loading",
    );
  });

  it("never calls a failed first load an empty wall", () => {
    expect(feedView({ hasData: false, isError: true, count: 0 })).toBe("error");
  });

  it("claims an empty wall only once the server has said so", () => {
    expect(feedView({ hasData: true, isError: false, count: 0 })).toBe("empty");
  });

  it("keeps posts on screen when a refresh fails", () => {
    expect(feedView({ hasData: true, isError: true, count: 4 })).toBe("posts");
    expect(feedView({ hasData: true, isError: false, count: 4 })).toBe("posts");
  });
});
