import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { configureStoryData } from "@novelsync/story-data-client";
import {
  publicChapterQuery,
  publicStoryPlaceholder,
  publicStoryQuery,
  storyViewerQuery,
} from "@/hooks/queries/publicStory";
import { publishedStoriesQuery } from "@/hooks/queries/publishedStories";
import { queryKeys } from "@/hooks/queries/queryKeys";
import { prefetchReaderChapter } from "@/routes/Story/prefetchStoryDetail";

const STORY_ID = "11111111-1111-1111-1111-111111111111";

const apiStory = {
  id: STORY_ID,
  authorId: "author-1",
  title: "The Long Crossing",
  description: "A caravan story.",
  authorName: "dev_user",
  category: "Fantasy",
  targetAudience: "",
  language: "",
  copyright: "",
  coverImageUrl: "",
  thumbnailUrl: "",
  tags: ["journey"],
  chapterCount: 6,
  views: 3,
  likeCount: 2,
  ratingsCount: 1,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-02T00:00:00Z",
};

let urls: string[];
let responses: Record<string, unknown>;

beforeEach(() => {
  urls = [];
  responses = {};
  configureStoryData({
    baseUrl: "https://story-data.test",
    sendDevUserHeader: false,
    getAuthContext: async () => ({ uid: "reader-1", token: "t" }),
    getUid: () => "reader-1",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      urls.push(url);
      const path = url.replace("https://story-data.test", "").split("?")[0];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses[path]),
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publicStoryQuery", () => {
  it("caches the detail under the key the loader and page share", async () => {
    responses[`/v1/public/stories/${STORY_ID}`] = {
      story: apiStory,
      chapters: [
        {
          id: "c1",
          storyId: STORY_ID,
          title: "One",
          position: 1,
          wordCount: 10,
        },
      ],
    };
    const client = new QueryClient();

    await client.prefetchQuery(publicStoryQuery(STORY_ID));
    await client.prefetchQuery(publicStoryQuery(STORY_ID));

    const cached = client.getQueryData(queryKeys.stories.detail(STORY_ID));
    expect(cached).toMatchObject({
      story: { id: STORY_ID, userId: "author-1", likes: 2 },
      chapters: [{ id: "c1", title: "One" }],
    });
    expect(urls).toHaveLength(1);
  });
});

describe("publicChapterQuery", () => {
  it("keeps a chapter for the session once fetched", async () => {
    responses[`/v1/public/stories/${STORY_ID}/chapters/c2`] = {
      id: "c2",
      storyId: STORY_ID,
      title: "Two",
      content: "<p>Body</p>",
      position: 2,
      wordCount: 1,
    };
    const client = new QueryClient();

    await client.prefetchQuery(publicChapterQuery(STORY_ID, "c2", "author-1"));
    await client.prefetchQuery(publicChapterQuery(STORY_ID, "c2", "author-1"));

    expect(
      client.getQueryData(queryKeys.stories.chapter(STORY_ID, "c2")),
    ).toMatchObject({ id: "c2", content: "<p>Body</p>", userId: "author-1" });
    expect(urls).toHaveLength(1);
  });
});

describe("prefetchReaderChapter", () => {
  it("prefetches a linked chapter using the author from the detail", async () => {
    responses[`/v1/public/stories/${STORY_ID}`] = {
      story: apiStory,
      chapters: [],
    };
    responses[`/v1/public/stories/${STORY_ID}/chapters/c4`] = {
      id: "c4",
      storyId: STORY_ID,
      title: "Four",
      content: "<p>Four</p>",
      position: 4,
      wordCount: 1,
    };
    const client = new QueryClient();

    await prefetchReaderChapter(STORY_ID, "c4", client);

    expect(
      client.getQueryData(queryKeys.stories.chapter(STORY_ID, "c4")),
    ).toMatchObject({ id: "c4", userId: "author-1" });
    expect(urls).toHaveLength(2);
  });
});

describe("storyViewerQuery", () => {
  it("combines the viewer's like, rating and reading progress", async () => {
    responses[`/v1/stories/${STORY_ID}/social/me`] = { liked: true, rating: 4 };
    responses[`/v1/me/reading-progress/${STORY_ID}`] = {
      storyId: STORY_ID,
      chapterId: "c3",
      scrollPercent: 0.5,
    };
    const client = new QueryClient();

    const viewer = await client.fetchQuery(
      storyViewerQuery(STORY_ID, "reader-1"),
    );

    expect(viewer).toEqual({
      liked: true,
      rating: 4,
      progress: { chapterId: "c3", scrollPercent: 0.5 },
    });
  });
});

describe("publicStoryPlaceholder", () => {
  it("builds a detail from the stories list without chapters", async () => {
    responses["/v1/public/stories"] = { stories: [apiStory] };
    const client = new QueryClient();
    await client.prefetchInfiniteQuery(publishedStoriesQuery("all"));

    const placeholder = publicStoryPlaceholder(client, STORY_ID);

    expect(placeholder?.story).toMatchObject({
      id: STORY_ID,
      userId: "author-1",
      title: "The Long Crossing",
      chapterCount: 6,
    });
    expect(placeholder?.chapters).toEqual([]);
  });

  it("returns nothing for a story the list has not loaded", () => {
    expect(publicStoryPlaceholder(new QueryClient(), STORY_ID)).toBeUndefined();
  });
});
