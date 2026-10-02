import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureStoryData,
  StoryWorkspaceRepo,
  type Story,
} from "@novelsync/story-data-client";

const apiChapter = (revision: number, content = "<p>body</p>") => ({
  id: "c1",
  storyId: "s1",
  title: "One",
  content,
  position: 0,
  wordCount: 1,
  revision,
});

const story = { id: "s1", userId: "u1" } as Story;

interface Call {
  url: string;
  method: string;
  ifMatch: string | undefined;
}

let calls: Call[];

function respondWith(...bodies: unknown[]) {
  const queue = [...bodies];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      calls.push({
        url,
        method: init.method ?? "GET",
        ifMatch: headers["If-Match"],
      });
      const body = queue.shift();
      return Promise.resolve(
        body === 404
          ? { ok: false, status: 404, json: () => Promise.resolve({}) }
          : { ok: true, status: 200, json: () => Promise.resolve(body) },
      );
    }),
  );
}

beforeEach(() => {
  calls = [];
  configureStoryData({
    baseUrl: "https://story-data.test",
    sendDevUserHeader: false,
    getAuthContext: async () => ({ uid: "u1", token: "t" }),
    getUid: () => "u1",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StoryWorkspaceRepo.getChapterIndex", () => {
  it("requests the index without bodies and returns summaries", async () => {
    respondWith([apiChapter(3, "")]);
    const index = await new StoryWorkspaceRepo().getChapterIndex("s1", "u1");

    expect(calls[0].url).toContain("/v1/stories/s1/chapters?content=false");
    expect(index).toEqual([
      {
        id: "c1",
        title: "One",
        order: 0,
        wordCount: 1,
        userId: "u1",
        revision: 3,
      },
    ]);
    expect(index[0]).not.toHaveProperty("content");
  });

  it("does not lend a newer index revision to an older body's save", async () => {
    const repo = new StoryWorkspaceRepo();
    respondWith(apiChapter(5), [apiChapter(6, "")], apiChapter(7));

    const body = await repo.getChapter("s1", "c1", "u1");
    await repo.getChapterIndex("s1", "u1");
    await repo.updateChapter(story, body!, "One", "<p>edit</p>");

    expect(calls[2]).toMatchObject({ method: "PATCH", ifMatch: "5" });
  });
});

describe("StoryWorkspaceRepo.getChapter", () => {
  it("returns one chapter with its body", async () => {
    respondWith(apiChapter(4));
    const chapter = await new StoryWorkspaceRepo().getChapter("s1", "c1", "u1");

    expect(calls[0].url).toContain("/v1/stories/s1/chapters/c1");
    expect(chapter).toMatchObject({
      id: "c1",
      content: "<p>body</p>",
      revision: 4,
    });
  });

  it("returns null for a deleted chapter", async () => {
    respondWith(404);
    await expect(
      new StoryWorkspaceRepo().getChapter("s1", "c1", "u1"),
    ).resolves.toBeNull();
  });
});

describe("StoryWorkspaceRepo writes", () => {
  it("sends the edited body's revision even after a newer read of it", async () => {
    const repo = new StoryWorkspaceRepo();
    respondWith(apiChapter(5), apiChapter(6), apiChapter(7));

    const editing = await repo.getChapter("s1", "c1", "u1");
    await repo.getChapter("s1", "c1", "u1");
    await repo.updateChapter(story, editing!, "One", "<p>edit</p>");

    expect(calls[2]).toMatchObject({ method: "PATCH", ifMatch: "5" });
  });

  it("sends the given story's revision even after a newer read of it", async () => {
    const repo = new StoryWorkspaceRepo();
    const apiStory = (revision: number) => ({
      id: "s1",
      ownerId: "u1",
      title: "T",
      description: "",
      authorName: "",
      category: "",
      targetAudience: "",
      language: "",
      copyright: "",
      coverImageUrl: "",
      thumbnailUrl: "",
      tags: [],
      published: false,
      revision,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    });
    respondWith(apiStory(2), apiStory(3), apiStory(4));

    const editing = await repo.getStory("s1");
    await repo.getStory("s1");
    await repo.updateStory({ ...editing!, title: "Renamed" });

    expect(calls[2]).toMatchObject({ method: "PATCH", ifMatch: "2" });
  });
});
