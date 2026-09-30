import { describe, expect, it } from "vitest";
import type { ChapterSummary } from "@novelsync/story-data-client";
import { neighbourChapterIds, toChapterSummary } from "@/lib/chapterIndex";

const summary = (id: string): ChapterSummary => ({
  id,
  title: id,
  order: 0,
  wordCount: 0,
  userId: "u1",
});

describe("toChapterSummary", () => {
  it("drops the body", () => {
    expect(toChapterSummary({ ...summary("c1"), content: "<p>x</p>" })).toEqual(
      summary("c1"),
    );
  });

  it("passes a summary through", () => {
    const chapter = summary("c1");
    expect(toChapterSummary(chapter)).toBe(chapter);
  });
});

describe("neighbourChapterIds", () => {
  const chapters = ["c1", "c2", "c3"].map(summary);

  it("returns both sides of a middle chapter", () => {
    expect(neighbourChapterIds(chapters, "c2")).toEqual(["c1", "c3"]);
  });

  it("returns one side at either end", () => {
    expect(neighbourChapterIds(chapters, "c1")).toEqual(["c2"]);
    expect(neighbourChapterIds(chapters, "c3")).toEqual(["c2"]);
  });

  it("returns nothing for an unknown chapter or a single chapter", () => {
    expect(neighbourChapterIds(chapters, "missing")).toEqual([]);
    expect(neighbourChapterIds([summary("c1")], "c1")).toEqual([]);
  });
});
