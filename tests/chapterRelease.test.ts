import { describe, expect, it } from "vitest";
import {
  chapterStatusLine,
  publishDescription,
  showsDraftMarks,
} from "@/lib/chapterRelease";

const draft = (wordCount = 100) => ({ wordCount });
const released = (wordCount = 100) => ({
  wordCount,
  publishedAt: new Date("2026-10-01T00:00:00Z"),
});

describe("publishDescription", () => {
  it("releases every written chapter when the author has released none", () => {
    const text = publishDescription("Tide", [draft(), draft(), draft(0)]);
    expect(text).toContain("the 2 chapters you have written will be released");
    expect(text).toContain("Empty chapters stay as drafts.");
  });

  it("leaves drafts alone once the author has released any chapter", () => {
    const text = publishDescription("Tide", [released(), draft(), draft()]);
    expect(text).toContain("with the 1 chapter you have released");
    expect(text).toContain("Your 2 chapters in draft stay private.");
    expect(text).not.toContain("will be released");
  });

  it("does not mention drafts when every chapter is already released", () => {
    const text = publishDescription("Tide", [released(), released()]);
    expect(text).toContain("with the 2 chapters you have released.");
    expect(text).not.toContain("in draft");
  });

  it("warns when there is nothing to read", () => {
    expect(publishDescription("Tide", [draft(0)])).toContain(
      "no chapter has any text yet",
    );
  });

  it("states the rule where chapters are not loaded", () => {
    expect(publishDescription("Tide")).toContain(
      "every chapter with text if you have not released any",
    );
  });
});

describe("showsDraftMarks", () => {
  it("stays quiet for an unpublished story with nothing released", () => {
    expect(showsDraftMarks(false, [draft(), draft()])).toBe(false);
  });

  it("marks drafts once the story is public or a chapter is released", () => {
    expect(showsDraftMarks(true, [draft()])).toBe(true);
    expect(showsDraftMarks(false, [released(), draft()])).toBe(true);
  });
});

describe("chapterStatusLine", () => {
  it("says a released chapter is not live until the story is", () => {
    expect(chapterStatusLine(true, false)).toContain("when you publish");
    expect(chapterStatusLine(true, true)).toContain("readers can read it");
    expect(chapterStatusLine(false, true)).toContain("only you");
  });
});
