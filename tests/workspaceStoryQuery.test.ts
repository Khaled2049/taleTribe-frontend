import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { storyWorkspaceRepo, type Story } from "@novelsync/story-data-client";
import { workspaceStoryQuery } from "@/hooks/queries/workspaceStory";
import { queryKeys } from "@/hooks/queries/queryKeys";

const story = { id: "s1", userId: "u1", title: "T" } as Story;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("workspaceStoryQuery", () => {
  it("scopes the key by uid and story", () => {
    expect(workspaceStoryQuery("u1", "s1").queryKey).not.toEqual(
      workspaceStoryQuery("u2", "s1").queryKey,
    );
    expect(workspaceStoryQuery("u1", "s1").queryKey).not.toEqual(
      workspaceStoryQuery("u1", "s2").queryKey,
    );
  });

  it("sits under the uid's workspace prefix that shelf mutations invalidate", () => {
    const prefix = queryKeys.workspace.all("u1");
    expect(
      workspaceStoryQuery("u1", "s1").queryKey.slice(0, prefix.length),
    ).toEqual([...prefix]);
  });

  it("serves the editor's read from the guard's fetch", async () => {
    const getStory = vi
      .spyOn(storyWorkspaceRepo, "getStory")
      .mockResolvedValue(story);
    const client = new QueryClient();

    await client.fetchQuery(workspaceStoryQuery("u1", "s1"));
    await expect(
      client.fetchQuery(workspaceStoryQuery("u1", "s1")),
    ).resolves.toBe(story);
    expect(getStory).toHaveBeenCalledTimes(1);
  });

  it("dedupes a read that starts while the guard's is in flight", async () => {
    const getStory = vi
      .spyOn(storyWorkspaceRepo, "getStory")
      .mockResolvedValue(story);
    const client = new QueryClient();

    await Promise.all([
      client.fetchQuery(workspaceStoryQuery("u1", "s1")),
      client.fetchQuery(workspaceStoryQuery("u1", "s1")),
    ]);
    expect(getStory).toHaveBeenCalledTimes(1);
  });

  it("refetches after a shelf mutation invalidates the uid's workspace", async () => {
    const getStory = vi
      .spyOn(storyWorkspaceRepo, "getStory")
      .mockResolvedValue(story);
    const client = new QueryClient();

    await client.fetchQuery(workspaceStoryQuery("u1", "s1"));
    await client.invalidateQueries({
      queryKey: queryKeys.workspace.all("u1"),
    });
    await client.fetchQuery(workspaceStoryQuery("u1", "s1"));
    expect(getStory).toHaveBeenCalledTimes(2);
  });
});
