import { describe, expect, it, vi } from "vitest";
import type { Story } from "@novelsync/story-data-client";
import { publishStory } from "@/lib/storyPublication";

const story: Story = {
  id: "s1",
  userId: "u1",
  title: "The Crossing",
  description: "A journey.",
  author: "Author",
  isPublished: false,
  completionStatus: "ongoing",
  nextChapterOn: "2026-11-01",
  readerNote: "Thank you for reading.",
  revision: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
  chapterCount: 2,
  views: 0,
  likes: 0,
};

function repository() {
  return {
    updateReaderUpdate: vi.fn().mockResolvedValue({
      ...story,
      completionStatus: "completed",
      nextChapterOn: undefined,
    }),
    updateStory: vi.fn().mockImplementation(async (saved: Story) => saved),
  };
}

describe("publishStory", () => {
  it("saves Completed before publishing, keeping the note and clearing the date", async () => {
    const repo = repository();
    const onStatusSaved = vi.fn();
    const saved = await publishStory(repo, story, "completed", onStatusSaved);

    expect(repo.updateReaderUpdate).toHaveBeenCalledWith("s1", {
      completionStatus: "completed",
      nextChapterOn: "",
      readerNote: story.readerNote,
    });
    expect(repo.updateReaderUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      repo.updateStory.mock.invocationCallOrder[0],
    );
    expect(saved).toMatchObject({
      completionStatus: "completed",
      nextChapterOn: undefined,
      isPublished: true,
      revision: story.revision,
    });
    expect(onStatusSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        completionStatus: "completed",
        isPublished: false,
      }),
    );
  });

  it("preserves the reader update when the selected status is unchanged", async () => {
    const repo = repository();
    const onStatusSaved = vi.fn();
    const saved = await publishStory(repo, story, "ongoing", onStatusSaved);
    expect(repo.updateReaderUpdate).not.toHaveBeenCalled();
    expect(onStatusSaved).not.toHaveBeenCalled();
    expect(saved).toMatchObject({
      isPublished: true,
      nextChapterOn: story.nextChapterOn,
      readerNote: story.readerNote,
    });
  });

  it("can publish a completed story as an ongoing serial", async () => {
    const repo = repository();
    repo.updateReaderUpdate.mockResolvedValue({
      ...story,
      nextChapterOn: undefined,
    });
    const saved = await publishStory(
      repo,
      { ...story, completionStatus: "completed", nextChapterOn: undefined },
      "ongoing",
      vi.fn(),
    );
    expect(repo.updateReaderUpdate).toHaveBeenCalledWith("s1", {
      completionStatus: "ongoing",
      nextChapterOn: "",
      readerNote: story.readerNote,
    });
    expect(saved).toMatchObject({
      completionStatus: "ongoing",
      isPublished: true,
    });
  });

  it("does not publish when saving the selected status fails", async () => {
    const repo = repository();
    repo.updateReaderUpdate.mockRejectedValue(new Error("Status save failed"));
    const onStatusSaved = vi.fn();
    await expect(
      publishStory(repo, story, "completed", onStatusSaved),
    ).rejects.toThrow("Status save failed");
    expect(repo.updateStory).not.toHaveBeenCalled();
    expect(onStatusSaved).not.toHaveBeenCalled();
  });

  it("reports a saved status even if the following publication fails", async () => {
    const repo = repository();
    repo.updateStory.mockRejectedValue(new Error("Publication failed"));
    const onStatusSaved = vi.fn();
    await expect(
      publishStory(repo, story, "completed", onStatusSaved),
    ).rejects.toThrow("Publication failed");
    expect(onStatusSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        completionStatus: "completed",
        isPublished: false,
      }),
    );
  });
});
