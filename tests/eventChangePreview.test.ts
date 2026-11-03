import { describe, expect, it, vi } from "vitest";
import {
  storyChangeSchema,
  type StoryChange,
} from "@novelsync/assistant-contracts";
import type { PlotEvent, PlotLine } from "@/types/IPlot";
import { chapterDiff } from "@/components/chat/eventChangePreview";
import {
  applyStoryChanges,
  type StoryChangeRepo,
} from "@/components/chat/storyChangeApply";
import {
  openAssistantWith,
  pendingAssistantPrompt,
  takeAssistantPrompt,
} from "@/components/chat/assistantPrompt";
import { chapterOptions } from "@/components/plot/plotChapters";

const chapters = chapterOptions([
  { id: "ch-harbour", title: "The Harbour", order: 1 },
  { id: "ch-ford", title: "The Ford", order: 2 },
  { id: "ch-pass", title: "The Pass", order: 3 },
]);

const event = (overrides: Partial<PlotEvent> & { id: string }): PlotEvent => ({
  name: overrides.id,
  content: "",
  characterIds: [],
  locationId: null,
  pacing: "moderate",
  storyBeat: "rising_action",
  orderIndex: 0,
  chapterId: null,
  status: "planned",
  revision: 1,
  ...overrides,
});

const lines: PlotLine[] = [
  {
    id: "plot-mutiny",
    name: "The Mutiny",
    description: "",
    revision: 1,
    events: [
      event({
        id: "ev-confront",
        name: "Mara confronts the captain",
        chapterId: "ch-harbour",
        chapterPosition: 1,
        revision: 7,
      }),
    ],
  },
];

const moveConfront = (
  boundChapter: StoryChange["boundChapter"],
  chapter: string,
): StoryChange => ({
  operation: "event.update",
  entityId: "ev-confront",
  plotLineId: "plot-mutiny",
  fields: { chapter },
  baseRevision: 7,
  label: "Mara confronts the captain",
  boundChapter,
});

function repo() {
  return {
    getPlots: vi.fn(async () => lines),
    addEvent: vi.fn(async (_s: string, _l: string, x: object) => ({
      ...(x as PlotEvent),
      id: "ev-new",
    })),
    updateEvent: vi.fn(async (_s: string, _l: string, x: PlotEvent) => x),
  };
}

describe("assistant event changes with a chapter", () => {
  it("saves the bound chapter id, never the drafted name", async () => {
    const fake = repo();
    const [result] = await applyStoryChanges(
      "story-1",
      {
        summary: "Move it.",
        changes: [moveConfront({ id: "ch-pass", label: "3 · The Pass" }, "3")],
      },
      fake as unknown as StoryChangeRepo,
    );
    expect(result.status).toBe("applied");
    const body = fake.updateEvent.mock.calls[0][2];
    expect(body).not.toHaveProperty("chapter");
    expect(body.chapterId).toBe("ch-pass");
  });

  it("creates an event in its chapter, and unassigns with a null chapter", async () => {
    const fake = repo();
    await applyStoryChanges(
      "story-1",
      {
        summary: "Plan it.",
        changes: [
          {
            operation: "event.create",
            plotLineId: "plot-mutiny",
            fields: { name: "Burns the letter", chapter: "2" },
            label: "Burns the letter",
            boundChapter: { id: "ch-ford", label: "2 · The Ford" },
          },
          moveConfront({ label: "Unassigned" }, "unassigned"),
        ],
      },
      fake as unknown as StoryChangeRepo,
    );
    expect(fake.addEvent.mock.calls[0][2]).toMatchObject({
      chapterId: "ch-ford",
      name: "Burns the letter",
    });
    expect(fake.updateEvent.mock.calls[0][2].chapterId).toBeNull();
  });

  it("leaves an event with an unsaved local edit to the writer", async () => {
    const fake = repo();
    const [result] = await applyStoryChanges(
      "story-1",
      {
        summary: "Move it.",
        changes: [moveConfront({ id: "ch-pass", label: "3 · The Pass" }, "3")],
      },
      fake as unknown as StoryChangeRepo,
      { hasUnsavedEdit: (id) => id === "ev-confront" },
    );
    expect(result.status).toBe("stale");
    expect(fake.updateEvent).not.toHaveBeenCalled();
  });

  it("shows the chapter move, and nothing when it stays put", () => {
    expect(
      chapterDiff(
        moveConfront({ id: "ch-pass", label: "3 · The Pass" }, "3"),
        lines,
        chapters,
      ),
    ).toEqual({ before: "1 · The Harbour", after: "3 · The Pass" });
    expect(
      chapterDiff(
        moveConfront({ id: "ch-harbour", label: "1 · The Harbour" }, "1"),
        lines,
        chapters,
      ),
    ).toBeNull();
  });

  it("refuses a chapter name the agent did not bind", () => {
    const bound = moveConfront({ id: "ch-pass", label: "3 · The Pass" }, "3");
    expect(storyChangeSchema.safeParse(bound).success).toBe(true);
    expect(
      storyChangeSchema.safeParse({ ...bound, boundChapter: undefined })
        .success,
    ).toBe(false);
  });
});

describe("opening the assistant with a prepared prompt", () => {
  it("hands the prompt once, to the story it was meant for", () => {
    openAssistantWith({ storyId: "story-1", prompt: "  Check the outline. " });
    expect(takeAssistantPrompt("story-2")).toBeNull();
    expect(takeAssistantPrompt("story-1")).toEqual({
      storyId: "story-1",
      prompt: "Check the outline.",
    });
    expect(pendingAssistantPrompt()).toBeNull();
  });
});
