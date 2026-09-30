import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureStoryData,
  publicStoryRepo,
} from "@novelsync/story-data-client";

const apiStory = (id: string, authorId: string, authorName: string) => ({
  id,
  authorId,
  title: `Story ${id}`,
  description: "",
  authorName,
  category: "fantasy",
  targetAudience: "",
  language: "",
  copyright: "",
  coverImageUrl: "",
  thumbnailUrl: "",
  tags: [],
  chapterCount: 1,
  views: 0,
  likeCount: 0,
  ratingsCount: 0,
  createdAt: "2026-09-14T12:00:00Z",
  updatedAt: "2026-09-14T12:00:00Z",
});

let urls: string[];

beforeEach(() => {
  urls = [];
  configureStoryData({
    baseUrl: "https://story-data.test",
    sendDevUserHeader: false,
    getAuthContext: async () => null,
    getUid: () => null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publicStoryRepo.getPublishedStories", () => {
  it("takes each author's name from the page itself, in one request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        urls.push(url);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              stories: [
                apiStory("s1", "u1", "renamed_alice"),
                apiStory("s2", "u2", "bob"),
              ],
              nextCursor: "next",
            }),
        });
      }),
    );

    const page = await publicStoryRepo.getPublishedStories(null, "fantasy");

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/v1/public/stories?");
    expect(page.stories.map((story) => [story.userId, story.author])).toEqual([
      ["u1", "renamed_alice"],
      ["u2", "bob"],
    ]);
    expect(page.cursor).toBe("next");
  });
});
