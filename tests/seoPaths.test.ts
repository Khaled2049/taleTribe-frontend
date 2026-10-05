import { describe, expect, it } from "vitest";
import {
  chapterPath,
  genrePath,
  slugify,
  storyIdFromParam,
  storyPath,
  tagPath,
} from "@/lib/seoPaths";

const STORY_ID = "3f2b8c1e-9d4a-4b6f-8e21-0a1b2c3d4e5f";

// The same vectors are asserted in functions/tests/seo.test.ts. If one side
// changes alone, the server starts redirecting every link the app renders.
describe("seoPaths", () => {
  it("slugifies titles", () => {
    expect(slugify("The Glass Cartographer")).toBe("the-glass-cartographer");
    expect(slugify("  Café — au lait!  ")).toBe("cafe-au-lait");
    expect(slugify("夜の物語")).toBe("");
    expect(slugify("a".repeat(70) + " b")).toBe("a".repeat(60));
  });

  it("builds and parses story paths", () => {
    expect(storyPath(STORY_ID, "The Glass Cartographer")).toBe(
      `/story/the-glass-cartographer-${STORY_ID}`,
    );
    expect(storyPath(STORY_ID, "夜の物語")).toBe(`/story/${STORY_ID}`);
    expect(storyPath(STORY_ID)).toBe(`/story/${STORY_ID}`);
    expect(chapterPath(STORY_ID, "A", "c1")).toBe(
      `/story/a-${STORY_ID}/read/c1`,
    );
    expect(storyIdFromParam(`the-glass-cartographer-${STORY_ID}`)).toBe(
      STORY_ID,
    );
    expect(storyIdFromParam(STORY_ID.toUpperCase())).toBe(STORY_ID);
    expect(storyIdFromParam("the-glass-cartographer")).toBeUndefined();
    expect(storyIdFromParam(`x${STORY_ID}`)).toBeUndefined();
  });

  it("builds tag and genre paths", () => {
    expect(tagPath("Dark Fantasy")).toBe("/stories/tag/dark-fantasy");
    expect(tagPath("c++")).toBe("/stories/tag/c%2B%2B");
    expect(genrePath("fantasy")).toBe("/stories/genre/fantasy");
    expect(genrePath("all")).toBe("/stories");
  });
});
