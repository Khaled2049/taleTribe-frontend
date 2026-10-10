import { describe, expect, it, vi } from "vitest";
import {
  StoryDataConflictError,
  StoryDataError,
  type Story,
} from "@novelsync/story-data-client";
import { isRetryableSaveError, saveStoryEdits } from "@/lib/storySave";

const story = (overrides: Partial<Story>) =>
  ({ id: "s1", title: "Old", revision: 1, ...overrides }) as Story;

describe("saveStoryEdits", () => {
  it("saves in one request when nothing changed elsewhere", async () => {
    const repo = {
      getStory: vi.fn(),
      updateStory: vi.fn(async (s: Story) => ({ ...s, revision: 2 })),
    };
    const saved = await saveStoryEdits(repo, story({}), { title: "New" });
    expect(saved.title).toBe("New");
    expect(repo.getStory).not.toHaveBeenCalled();
  });

  it("re-applies the title to the current copy after a conflict", async () => {
    const current = story({ revision: 5, isPublished: true });
    const repo = {
      getStory: vi.fn(async () => current),
      updateStory: vi
        .fn<(s: Story) => Promise<Story>>()
        .mockRejectedValueOnce(new StoryDataConflictError())
        .mockImplementation(async (s) => s),
    };
    const saved = await saveStoryEdits(repo, story({}), { title: "New" });
    expect(saved).toMatchObject({
      title: "New",
      revision: 5,
      isPublished: true,
    });
  });

  it("does not retry other failures, or a second conflict", async () => {
    const failing = {
      getStory: vi.fn(),
      updateStory: vi.fn().mockRejectedValue(new StoryDataError(500, "boom")),
    };
    await expect(
      saveStoryEdits(failing, story({}), { title: "New" }),
    ).rejects.toThrow("boom");
    expect(failing.updateStory).toHaveBeenCalledTimes(1);

    const contended = {
      getStory: vi.fn(async () => story({ revision: 5 })),
      updateStory: vi.fn().mockRejectedValue(new StoryDataConflictError()),
    };
    await expect(
      saveStoryEdits(contended, story({}), { title: "New" }),
    ).rejects.toBeInstanceOf(StoryDataConflictError);
    expect(contended.updateStory).toHaveBeenCalledTimes(2);
  });
});

describe("saveStoryEdits with a paragraph style", () => {
  it("keeps the style edit when re-applying after a conflict", async () => {
    const repo = {
      getStory: vi.fn(async () => story({ revision: 5, title: "Theirs" })),
      updateStory: vi
        .fn<(s: Story) => Promise<Story>>()
        .mockRejectedValueOnce(new StoryDataConflictError())
        .mockImplementation(async (s) => s),
    };
    const saved = await saveStoryEdits(repo, story({}), {
      paragraphStyle: "indented",
    });
    expect(saved).toMatchObject({
      title: "Theirs",
      revision: 5,
      paragraphStyle: "indented",
    });
  });
});

describe("isRetryableSaveError", () => {
  it("retries a dropped connection and a struggling server", () => {
    expect(isRetryableSaveError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryableSaveError(new StoryDataError(503, "down"))).toBe(true);
    expect(isRetryableSaveError(new StoryDataError(429, "slow down"))).toBe(
      true,
    );
  });

  it("does not retry a conflict, a rejected payload or a local error", () => {
    expect(isRetryableSaveError(new StoryDataConflictError())).toBe(false);
    expect(isRetryableSaveError(new StoryDataError(400, "too long"))).toBe(
      false,
    );
    expect(isRetryableSaveError(new Error("No story selected"))).toBe(false);
  });
});
