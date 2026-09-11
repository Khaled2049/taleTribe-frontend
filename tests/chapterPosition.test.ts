import { describe, expect, it } from "vitest";
import type { Chapter } from "@novelsync/story-data-client";
import { nextChapterPosition } from "@/utils/chapterPosition";

function chapters(...positions: number[]): Chapter[] {
  return positions.map((order, index) => ({
    id: `chapter-${index}`,
    title: `Chapter ${index}`,
    content: "",
    order,
    wordCount: 0,
    userId: "user",
  }));
}

describe("nextChapterPosition", () => {
  it("starts at 0 for a story with no chapters", () => {
    expect(nextChapterPosition([])).toBe(0);
  });

  it("appends after the last chapter of a contiguous story", () => {
    expect(nextChapterPosition(chapters(0, 1, 2))).toBe(3);
  });

  it("skips past the gap a deleted chapter leaves behind", () => {
    expect(nextChapterPosition(chapters(1, 2))).toBe(3);
    expect(nextChapterPosition(chapters(2))).toBe(3);
  });

  it("does not assume the chapters arrive in position order", () => {
    expect(nextChapterPosition(chapters(4, 0, 2))).toBe(5);
  });

  it("returns a whole position past a fractional one", () => {
    expect(nextChapterPosition(chapters(0, 1.5))).toBe(2);
    expect(nextChapterPosition(chapters(0, 1.5, 2))).toBe(3);
  });
});
