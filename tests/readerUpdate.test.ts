import { describe, expect, it } from "vitest";
import {
  localToday,
  normalizeReaderUpdate,
  readerUpdateChanged,
  readerUpdateOf,
  storyMetadataChanged,
} from "@/lib/readerUpdate";

describe("readerUpdateOf", () => {
  it("reads a story that predates the fields as ongoing with nothing set", () => {
    expect(readerUpdateOf({})).toEqual({
      completionStatus: "ongoing",
      nextChapterOn: "",
      readerNote: "",
    });
  });
});

describe("normalizeReaderUpdate", () => {
  it("drops the date from a completed story and trims the note", () => {
    expect(
      normalizeReaderUpdate({
        completionStatus: "completed",
        nextChapterOn: "2026-11-01",
        readerNote: "  The end.  ",
      }),
    ).toEqual({
      completionStatus: "completed",
      nextChapterOn: "",
      readerNote: "The end.",
    });
  });
});

describe("readerUpdateChanged", () => {
  const story = {
    completionStatus: "ongoing" as const,
    nextChapterOn: "2026-11-01",
    readerNote: "Fridays.",
  };

  it("is false when only whitespace differs", () => {
    expect(
      readerUpdateChanged(story, {
        completionStatus: "ongoing",
        nextChapterOn: "2026-11-01",
        readerNote: "Fridays. ",
      }),
    ).toBe(false);
  });

  it("is true for a new status, date or note", () => {
    const same = readerUpdateOf(story);
    expect(
      readerUpdateChanged(story, { ...same, completionStatus: "completed" }),
    ).toBe(true);
    expect(readerUpdateChanged(story, { ...same, nextChapterOn: "" })).toBe(
      true,
    );
    expect(readerUpdateChanged(story, { ...same, readerNote: "Soon." })).toBe(
      true,
    );
  });

  it("is false for an untouched story that predates the fields", () => {
    expect(readerUpdateChanged({}, readerUpdateOf({}))).toBe(false);
  });
});

describe("localToday", () => {
  it("uses the local calendar date, zero-padded", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("storyMetadataChanged", () => {
  const story = { title: "Tide", description: "", tags: ["sea", "loss"] };

  it("treats an unset field and an empty one as the same", () => {
    expect(
      storyMetadataChanged(story, {
        title: "Tide",
        description: "",
        category: "",
        tags: ["sea", "loss"],
      }),
    ).toBe(false);
  });

  it("notices a changed field or tag list", () => {
    expect(storyMetadataChanged(story, { title: "Tides" })).toBe(true);
    expect(storyMetadataChanged(story, { tags: ["sea"] })).toBe(true);
    expect(storyMetadataChanged(story, { category: "fantasy" })).toBe(true);
  });
});
