import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  storyWorkspaceRepo,
  type Chapter,
  type ChapterSummary,
  type Story,
} from "@novelsync/story-data-client";
import {
  prefetchWorkspaceData,
  workspaceChapterIndexQuery,
  workspaceChapterQuery,
  workspaceStoryQuery,
} from "@/hooks/queries/workspaceStory";
import { loadWorkspace } from "@/lib/workspaceLoad";

const story = { id: "s1", userId: "u1", title: "T" } as Story;
const summary = (id: string): ChapterSummary => ({
  id,
  title: id,
  order: 0,
  wordCount: 1,
  userId: "u1",
  revision: 1,
});
const body = (id: string): Chapter => ({ ...summary(id), content: "<p/>" });

function stubRepo(index: ChapterSummary[] = [summary("c1"), summary("c2")]) {
  return {
    getStory: vi.spyOn(storyWorkspaceRepo, "getStory").mockResolvedValue(story),
    getChapterIndex: vi
      .spyOn(storyWorkspaceRepo, "getChapterIndex")
      .mockResolvedValue(index),
    getChapter: vi
      .spyOn(storyWorkspaceRepo, "getChapter")
      .mockImplementation(async (_storyId, chapterId) => body(chapterId)),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prefetchWorkspaceData", () => {
  it("warms the story, the index and only the first body", async () => {
    const repo = stubRepo();
    await prefetchWorkspaceData(new QueryClient(), "u1", "s1");

    expect(repo.getStory).toHaveBeenCalledTimes(1);
    expect(repo.getChapterIndex).toHaveBeenCalledTimes(1);
    expect(repo.getChapter.mock.calls.map((call) => call[1])).toEqual(["c1"]);
  });

  it("warms a requested chapter instead of the first", async () => {
    const repo = stubRepo();
    await prefetchWorkspaceData(new QueryClient(), "u1", "s1", "c2");

    expect(repo.getStory).toHaveBeenCalledTimes(1);
    expect(repo.getChapterIndex).toHaveBeenCalledTimes(1);
    expect(repo.getChapter.mock.calls.map((call) => call[1])).toEqual(["c2"]);
  });

  it("fetches no body for an empty story", async () => {
    const repo = stubRepo([]);
    await prefetchWorkspaceData(new QueryClient(), "u1", "s1");
    expect(repo.getChapter).not.toHaveBeenCalled();
  });

  it("resolves when a read fails", async () => {
    const repo = stubRepo();
    repo.getChapterIndex.mockRejectedValue(new Error("503"));
    repo.getStory.mockRejectedValue(new Error("503"));
    await expect(
      prefetchWorkspaceData(
        new QueryClient({ defaultOptions: { queries: { retry: false } } }),
        "u1",
        "s1",
      ),
    ).resolves.toBeUndefined();
    expect(repo.getChapter).not.toHaveBeenCalled();
  });

  it("does not refetch on repeated hovers", async () => {
    const repo = stubRepo();
    const client = new QueryClient();
    await prefetchWorkspaceData(client, "u1", "s1");
    await prefetchWorkspaceData(client, "u1", "s1");

    expect(repo.getStory).toHaveBeenCalledTimes(1);
    expect(repo.getChapterIndex).toHaveBeenCalledTimes(1);
    expect(repo.getChapter).toHaveBeenCalledTimes(1);
  });

  it("leaves the editor's entry load with nothing to fetch", async () => {
    const repo = stubRepo();
    const client = new QueryClient();
    await prefetchWorkspaceData(client, "u1", "s1");

    const result = await loadWorkspace(
      {
        getStory: (id) => client.fetchQuery(workspaceStoryQuery("u1", id)),
        getChapterIndex: (id) =>
          client.fetchQuery(workspaceChapterIndexQuery("u1", id)),
        getChapter: (id, chapterId) =>
          client.fetchQuery(workspaceChapterQuery("u1", id, chapterId)),
      },
      "s1",
    );

    expect(result).toMatchObject({
      status: "loaded",
      currentChapter: { id: "c1" },
    });
    expect(repo.getStory).toHaveBeenCalledTimes(1);
    expect(repo.getChapterIndex).toHaveBeenCalledTimes(1);
    expect(repo.getChapter).toHaveBeenCalledTimes(1);
  });
});
