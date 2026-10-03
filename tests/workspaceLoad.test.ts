import { describe, expect, it } from "vitest";
import type {
  Chapter,
  ChapterSummary,
  Story,
} from "@novelsync/story-data-client";
import { loadWorkspace, WorkspaceReader } from "@/lib/workspaceLoad";
import { editorReducer, initialEditorState } from "@/hooks/useEditorState";

const story = { id: "s1", userId: "u1", title: "T", description: "" } as Story;
const summary = (id: string, order: number): ChapterSummary => ({
  id,
  title: id,
  order,
  wordCount: 1,
  userId: "u1",
  revision: 1,
});
const body = (id: string): Chapter => ({
  ...summary(id, 0),
  content: `<p>${id}</p>`,
});
const index = [summary("c1", 0), summary("c2", 1)];

const reader = (overrides: Partial<WorkspaceReader> = {}): WorkspaceReader => ({
  getStory: async () => story,
  getChapterIndex: async () => index,
  getChapter: async (_storyId, chapterId) => body(chapterId),
  ...overrides,
});

describe("loadWorkspace", () => {
  it("returns the story, the index and only the first chapter's body", async () => {
    const requested: string[] = [];
    const result = await loadWorkspace(
      reader({
        getChapter: async (_storyId, chapterId) => {
          requested.push(chapterId);
          return body(chapterId);
        },
      }),
      "s1",
    );
    expect(result).toEqual({
      status: "loaded",
      story,
      chapters: index,
      currentChapter: body("c1"),
    });
    expect(requested).toEqual(["c1"]);
  });

  it("starts the index read before the story read resolves", async () => {
    let indexStarted = false;
    let releaseStory!: (value: Story) => void;
    const pending = loadWorkspace(
      reader({
        getStory: () =>
          new Promise<Story>((resolve) => {
            releaseStory = resolve;
          }),
        getChapterIndex: async () => {
          indexStarted = true;
          return index;
        },
      }),
      "s1",
    );
    await Promise.resolve();
    expect(indexStarted).toBe(true);
    releaseStory(story);
    await expect(pending).resolves.toMatchObject({ status: "loaded" });
  });

  it("reports a missing story even though its index read fails", async () => {
    const result = await loadWorkspace(
      reader({
        getStory: async () => null,
        getChapterIndex: async () => {
          throw new Error("404");
        },
      }),
      "s1",
    );
    expect(result).toEqual({ status: "missing" });
  });

  it("loads an empty story with no current chapter", async () => {
    const result = await loadWorkspace(
      reader({ getChapterIndex: async () => [] }),
      "s1",
    );
    expect(result).toMatchObject({ status: "loaded", currentChapter: null });
  });

  it("leaves no current chapter when the first body has been deleted", async () => {
    const result = await loadWorkspace(
      reader({ getChapter: async () => null }),
      "s1",
    );
    expect(result).toMatchObject({ status: "loaded", currentChapter: null });
  });

  it("opens the requested chapter, reading its body alongside the index", async () => {
    let bodyStartedBeforeIndex = false;
    let indexResolved = false;
    let releaseIndex!: (value: ChapterSummary[]) => void;
    const pending = loadWorkspace(
      reader({
        getChapterIndex: () =>
          new Promise<ChapterSummary[]>((resolve) => {
            releaseIndex = (value) => {
              indexResolved = true;
              resolve(value);
            };
          }),
        getChapter: async (_storyId, chapterId) => {
          if (!indexResolved) bodyStartedBeforeIndex = true;
          return body(chapterId);
        },
      }),
      "s1",
      "c2",
    );
    await Promise.resolve();
    releaseIndex(index);
    await expect(pending).resolves.toMatchObject({
      status: "loaded",
      currentChapter: body("c2"),
    });
    expect(bodyStartedBeforeIndex).toBe(true);
  });

  it("falls back to the first chapter when the requested one is not in the index", async () => {
    const result = await loadWorkspace(reader(), "s1", "gone");
    expect(result).toMatchObject({ currentChapter: body("c1") });
  });

  it("re-reads the requested body when its early read failed", async () => {
    let calls = 0;
    const result = await loadWorkspace(
      reader({
        getChapter: async (_storyId, chapterId) => {
          calls += 1;
          if (calls === 1) throw new Error("503");
          return body(chapterId);
        },
      }),
      "s1",
      "c2",
    );
    expect(result).toMatchObject({ currentChapter: body("c2") });
    expect(calls).toBe(2);
  });

  it.each([
    ["story", { getStory: () => Promise.reject(new Error("503")) }],
    ["index", { getChapterIndex: () => Promise.reject(new Error("503")) }],
    ["body", { getChapter: () => Promise.reject(new Error("503")) }],
  ] as const)(
    "resolves with an error when the %s read fails",
    async (_, overrides) => {
      const result = await loadWorkspace(reader(overrides), "s1");
      expect(result).toMatchObject({ status: "error" });
    },
  );
});

describe("editorReducer load lifecycle", () => {
  it("leaves the loading state on failure", () => {
    const next = editorReducer(initialEditorState, {
      type: "LOAD_FAILED",
      payload: "error",
    });
    expect(next.isLoading).toBe(false);
    expect(next.loadError).toBe("error");
  });

  it("clears a previous failure when a retry starts", () => {
    const failed = editorReducer(initialEditorState, {
      type: "LOAD_FAILED",
      payload: "missing",
    });
    const retrying = editorReducer(failed, {
      type: "SET_LOADING",
      payload: true,
    });
    expect(retrying.isLoading).toBe(true);
    expect(retrying.loadError).toBeNull();
  });

  it("clears a previous failure when the story loads", () => {
    const failed = editorReducer(initialEditorState, {
      type: "LOAD_FAILED",
      payload: "error",
    });
    const loaded = editorReducer(failed, {
      type: "LOAD_STORY",
      payload: {
        story,
        chapters: index,
        currentChapter: body("c1"),
        leftSidebarOpen: false,
      },
    });
    expect(loaded.loadError).toBeNull();
    expect(loaded.isLoading).toBe(false);
    expect(loaded.currentChapter?.id).toBe("c1");
  });
});

describe("editorReducer chapter opening", () => {
  const loaded = editorReducer(initialEditorState, {
    type: "LOAD_STORY",
    payload: {
      story,
      chapters: index,
      currentChapter: body("c1"),
      leftSidebarOpen: false,
    },
  });

  it("keeps the current chapter while the next body loads", () => {
    const opening = editorReducer(loaded, {
      type: "BEGIN_CHAPTER_OPEN",
      payload: index[1],
    });
    expect(opening.openingChapter?.id).toBe("c2");
    expect(opening.currentChapter?.id).toBe("c1");
  });

  it("switches once the body arrives", () => {
    const opening = editorReducer(loaded, {
      type: "BEGIN_CHAPTER_OPEN",
      payload: index[1],
    });
    const selected = editorReducer(opening, {
      type: "SELECT_CHAPTER",
      payload: body("c2"),
    });
    expect(selected.openingChapter).toBeNull();
    expect(selected.currentChapter?.id).toBe("c2");
    expect(selected.chapterTitle).toBe("c2");
  });

  it("stays on the current chapter when opening fails", () => {
    const opening = editorReducer(loaded, {
      type: "BEGIN_CHAPTER_OPEN",
      payload: index[1],
    });
    const failed = editorReducer(opening, { type: "CHAPTER_OPEN_FAILED" });
    expect(failed.openingChapter).toBeNull();
    expect(failed.currentChapter?.id).toBe("c1");
  });

  it("clears the current chapter when it is deleted, leaving the caller to open another", () => {
    const next = editorReducer(loaded, {
      type: "DELETE_CHAPTER",
      payload: "c1",
    });
    expect(next.currentChapter).toBeNull();
    expect(next.chapters.map((c) => c.id)).toEqual(["c2"]);
  });

  it("never stores a body in the index", () => {
    const added = editorReducer(loaded, {
      type: "ADD_CHAPTER",
      payload: body("c3"),
    });
    const updated = editorReducer(added, {
      type: "UPDATE_CHAPTER_IN_LIST",
      payload: { id: "c3", updates: { ...body("c3"), content: "<p>edit</p>" } },
    });
    for (const chapter of updated.chapters) {
      expect(chapter).not.toHaveProperty("content");
    }
    expect(updated.currentChapter?.content).toBe("<p>edit</p>");
  });
});
