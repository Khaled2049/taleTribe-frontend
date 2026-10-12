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
    expect(text).toContain("release 2 chapters");
    expect(text).toContain("Empty chapters stay private.");
  });

  it("leaves drafts alone once the author has released any chapter", () => {
    const text = publishDescription("Tide", [released(), draft(), draft()]);
    expect(text).toContain("with 1 chapter.");
    expect(text).toContain("2 chapters stay private.");
    expect(text).not.toContain("release 3 chapters");
  });

  it("does not mention drafts when every chapter is already released", () => {
    const text = publishDescription("Tide", [released(), released()]);
    expect(text).toContain("with 2 chapters.");
    expect(text).not.toContain("private");
  });

  it("warns when there is nothing to read", () => {
    expect(publishDescription("Tide", [draft(0)])).toContain(
      "without any chapter text?",
    );
  });

  it("states the rule where chapters are not loaded", () => {
    expect(publishDescription("Tide")).toContain(
      "all chapters with text if none are released",
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
    expect(chapterStatusLine(true, false)).toContain("Publish to go live");
    expect(chapterStatusLine(true, true)).toContain("Live");
    expect(chapterStatusLine(false, true)).toContain("Private");
  });
});
