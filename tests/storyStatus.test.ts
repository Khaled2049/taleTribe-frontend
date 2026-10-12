import { describe, expect, it } from "vitest";
import {
  formatNextChapterDate,
  readerUpdateView,
  statusFromParam,
} from "@/lib/storyStatus";

const now = new Date(2026, 9, 12);

describe("statusFromParam", () => {
  it("accepts the two statuses and reads anything else as all", () => {
    expect(statusFromParam("ongoing")).toBe("ongoing");
    expect(statusFromParam("completed")).toBe("completed");
    expect(statusFromParam("hiatus")).toBe("");
    expect(statusFromParam(null)).toBe("");
  });
});

describe("formatNextChapterDate", () => {
  it("keeps the calendar day the author chose", () => {
    expect(formatNextChapterDate("2026-10-20", now, "en-US")).toBe(
      "October 20",
    );
  });

  it("adds the year when it is not this one", () => {
    expect(formatNextChapterDate("2027-01-03", now, "en-US")).toBe(
      "January 3, 2027",
    );
  });

  it("returns null for a missing or malformed date", () => {
    expect(formatNextChapterDate(undefined, now)).toBeNull();
    expect(formatNextChapterDate("soon", now)).toBeNull();
  });
});

describe("readerUpdateView", () => {
  it("is null when the author has said nothing", () => {
    expect(readerUpdateView({ completionStatus: "ongoing" }, now)).toBeNull();
    expect(readerUpdateView({ readerNote: "   " }, now)).toBeNull();
  });

  it("carries the date and the note for an ongoing story", () => {
    expect(
      readerUpdateView(
        {
          completionStatus: "ongoing",
          nextChapterOn: "2026-10-20",
          readerNote: "Fridays.",
        },
        now,
        "en-US",
      ),
    ).toEqual({ nextChapter: "October 20", note: "Fridays." });
  });

  it("never promises a next chapter for a completed story", () => {
    expect(
      readerUpdateView(
        {
          completionStatus: "completed",
          nextChapterOn: "2026-10-20",
          readerNote: "Thank you for reading.",
        },
        now,
        "en-US",
      ),
    ).toEqual({ nextChapter: null, note: "Thank you for reading." });
  });
});
