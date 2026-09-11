import { describe, expect, it } from "vitest";
import {
  CHAPTER_WORD_LIMIT,
  chapterWordCount,
} from "../src/utils/chapterWordLimit";

function goWordCount(s: string): number {
  let n = 0;
  let inWord = false;
  for (const r of s) {
    if (r === " " || r === "\n" || r === "\t" || r === "\r") {
      inWord = false;
    } else if (!inWord) {
      n++;
      inWord = true;
    }
  }
  return n;
}

describe("chapterWordCount", () => {
  it("counts markup, because the server counts the stored HTML", () => {
    expect(chapterWordCount("<p>Hello world</p>")).toBe(2);
  });

  it("merges adjacent block tags, because TipTap emits no whitespace there", () => {
    expect(chapterWordCount("<p>one</p><p>two</p>")).toBe(1);
  });

  it("splits attribute values that contain spaces", () => {
    expect(chapterWordCount('<p style="text-align: center">hi</p>')).toBe(3);
  });

  it("treats a non-breaking space as part of a word, as Go does", () => {
    expect(chapterWordCount("a b")).toBe(1);
    expect(chapterWordCount("a b")).toBe(2);
  });

  it("returns 0 for empty and whitespace-only content", () => {
    expect(chapterWordCount("")).toBe(0);
    expect(chapterWordCount("   \n\t\r ")).toBe(0);
  });

  it("matches the Go implementation across representative documents", () => {
    const samples = [
      "",
      "   ",
      "<p></p>",
      "<p>Hello world</p>",
      "<p>one</p><p>two</p><p>three</p>",
      '<h1 class="text-3xl font-bold mb-4">A Title</h1><p>Body text here.</p>',
      '<p style="text-align: center; line-height: 1.8">Centred.</p>',
      "<p>Trailing space </p>\n<p>\tTabbed</p>\r\n",
      "a b c",
      "<ul><li>first</li><li>second</li></ul>",
    ];
    for (const sample of samples) {
      expect(chapterWordCount(sample)).toBe(goWordCount(sample));
    }
  });

  it("keeps the ceiling in sync with the server constant", () => {
    expect(CHAPTER_WORD_LIMIT).toBe(5000);
  });
});
