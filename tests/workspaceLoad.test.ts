import { describe, expect, it } from "vitest";
import type { Chapter, Story } from "@novelsync/story-data-client";
import { loadWorkspace, WorkspaceReader } from "@/lib/workspaceLoad";
import { editorReducer, initialEditorState } from "@/hooks/useEditorState";

const story = { id: "s1", userId: "u1", title: "T", description: "" } as Story;
const chapters = [{ id: "c1", title: "One", content: "<p>x</p>" }] as Chapter[];

const reader = (overrides: Partial<WorkspaceReader> = {}): WorkspaceReader => ({
  getStory: async () => story,
  getChapters: async () => chapters,
  ...overrides,
});

describe("loadWorkspace", () => {
  it("returns the story and its chapters", async () => {
    await expect(loadWorkspace(reader(), "s1")).resolves.toEqual({
      status: "loaded",
      story,
      chapters,
    });
  });

  it("reports a missing story without fetching chapters", async () => {
    let chaptersRequested = false;
    const result = await loadWorkspace(
      reader({
        getStory: async () => null,
        getChapters: async () => {
          chaptersRequested = true;
          return [];
        },
      }),
      "s1",
    );
    expect(result).toEqual({ status: "missing" });
    expect(chaptersRequested).toBe(false);
  });

  it("resolves with an error when the story read fails", async () => {
    const error = new Error("503");
    const result = await loadWorkspace(
      reader({
        getStory: async () => {
          throw error;
        },
      }),
      "s1",
    );
    expect(result).toEqual({ status: "error", error });
  });

  it("resolves with an error when the chapter read fails", async () => {
    const error = new Error("503");
    const result = await loadWorkspace(
      reader({
        getChapters: async () => {
          throw error;
        },
      }),
      "s1",
    );
    expect(result).toEqual({ status: "error", error });
  });
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
        chapters,
        currentChapter: chapters[0],
        leftSidebarOpen: false,
      },
    });
    expect(loaded.loadError).toBeNull();
    expect(loaded.isLoading).toBe(false);
    expect(loaded.currentChapter?.id).toBe("c1");
  });
});
