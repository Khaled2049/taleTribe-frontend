import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { configureStoryData } from "@novelsync/story-data-client";
import { publishedStoriesQuery } from "@/hooks/queries/publishedStories";
import { queryKeys } from "@/hooks/queries/queryKeys";

let urls: string[];

const page = (cursor?: string) => ({ stories: [], nextCursor: cursor });

beforeEach(() => {
  urls = [];
  configureStoryData({
    baseUrl: "https://story-data.test",
    sendDevUserHeader: false,
    getAuthContext: async () => null,
    getUid: () => null,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      urls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(page("c2")),
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publishedStoriesQuery", () => {
  it("prefetches the first page under the key the stories page reads", async () => {
    const client = new QueryClient();

    await client.prefetchInfiniteQuery(publishedStoriesQuery("all"));

    const cached = client.getQueryData<{ pages: unknown[] }>(
      queryKeys.stories.byCategory("all", ""),
    );
    expect(cached?.pages).toHaveLength(1);
    expect(urls).toHaveLength(1);
    expect(urls[0]).not.toContain("category=");
  });

  it("does not refetch a first page that is still fresh", async () => {
    const client = new QueryClient();

    await client.prefetchInfiniteQuery(publishedStoriesQuery("all"));
    await client.prefetchInfiniteQuery(publishedStoriesQuery("all"));

    expect(urls).toHaveLength(1);
  });

  it("sends the category and search for a filtered grid", async () => {
    const client = new QueryClient();

    await client.prefetchInfiniteQuery(
      publishedStoriesQuery("fantasy", "dragons"),
    );

    expect(urls[0]).toContain("category=fantasy");
    expect(urls[0]).toContain("q=dragons");
  });

  it("stops paging when the server returns no cursor", () => {
    const { getNextPageParam } = publishedStoriesQuery("all");
    const next = (cursor: string | null) =>
      getNextPageParam({ stories: [], cursor }, [], null, [null]);

    expect(next("c2")).toBe("c2");
    expect(next(null)).toBeUndefined();
  });
});
