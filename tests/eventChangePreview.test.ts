import { describe, expect, it, vi } from "vitest";
import {
  storyChangeSchema,
  type StoryChange,
} from "@novelsync/assistant-contracts";
import type { PlotEvent, PlotLine } from "@/types/IPlot";
import {
  chapterDiff,
  outOfOrderWarnings,
  requiresDiff,
} from "@/components/chat/eventChangePreview";
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
  dependencies: [],
  dependents: [],
  tensionLevel: 5,
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
        dependencies: [
          {
            eventId: "ev-rumour",
            plotLineId: "plot-letters",
            relationshipType: "requires",
            description: "She heard it first",
            outOfOrderOk: true,
          },
        ],
      }),
    ],
  },
  {
    id: "plot-letters",
    name: "Letters",
    description: "",
    revision: 1,
    events: [
      event({
        id: "ev-letter",
        name: "Finds the letter",
        chapterId: "ch-ford",
        chapterPosition: 1,
      }),
      event({ id: "ev-rumour", name: "Rumour spreads" }),
    ],
  },
];

const updateConfront = (
  extra: Pick<StoryChange, "boundChapter" | "boundRequires">,
  fields: StoryChange["fields"],
): StoryChange => ({
  operation: "event.update",
  entityId: "ev-confront",
  plotLineId: "plot-mutiny",
  fields,
  baseRevision: 7,
  label: "Mara confronts the captain",
  ...extra,
});

const moveAndRequire = updateConfront(
  {
    boundChapter: { id: "ch-pass", label: "3 · The Pass" },
    boundRequires: [
      { id: "ev-rumour", label: "Rumour spreads" },
      { id: "ev-letter", label: "Finds the letter" },
    ],
  },
  { chapter: "The Pass", requires: ["Rumour spreads", "Finds the letter"] },
);

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

describe("assistant event changes with a chapter and requirements", () => {
  it("saves the bound ids, keeping a kept requirement's note and mark", async () => {
    const fake = repo();
    const [result] = await applyStoryChanges(
      "story-1",
      { summary: "Move it.", changes: [moveAndRequire] },
      fake as unknown as StoryChangeRepo,
    );
    expect(result.status).toBe("applied");
    const body = fake.updateEvent.mock.calls[0][2];
    expect(body).not.toHaveProperty("chapter");
    expect(body).not.toHaveProperty("requires");
    expect(body.chapterId).toBe("ch-pass");
    expect(body.dependencies).toEqual([
      lines[0].events[0].dependencies[0],
      {
        eventId: "ev-letter",
        plotLineId: "plot-letters",
        relationshipType: "requires",
        outOfOrderOk: false,
      },
    ]);
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
            plotLineId: "plot-letters",
            fields: { name: "Burns the letter", chapter: "2" },
            label: "Burns the letter",
            boundChapter: { id: "ch-ford", label: "2 · The Ford" },
          },
          updateConfront(
            { boundChapter: { label: "Unassigned" } },
            { chapter: "unassigned" },
          ),
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
      { summary: "Move it.", changes: [moveAndRequire] },
      fake as unknown as StoryChangeRepo,
      { hasUnsavedEdit: (id) => id === "ev-confront" },
    );
    expect(result.status).toBe("stale");
    expect(fake.updateEvent).not.toHaveBeenCalled();
  });

  it("shows the chapter move and the requirements added and removed", () => {
    expect(chapterDiff(moveAndRequire, lines, chapters)).toEqual({
      before: "1 · The Harbour",
      after: "3 · The Pass",
    });
    expect(
      requiresDiff(
        updateConfront(
          { boundRequires: [{ id: "ev-letter", label: "Finds the letter" }] },
          { requires: ["Finds the letter"] },
        ),
        lines,
      ),
    ).toEqual({ added: ["Finds the letter"], removed: ["Rumour spreads"] });
    const unchanged = updateConfront(
      { boundChapter: { id: "ch-harbour", label: "1 · The Harbour" } },
      { chapter: "1" },
    );
    expect(chapterDiff(unchanged, lines, chapters)).toBeNull();
  });

  it("warns when a requirement would come after the event once saved", () => {
    const backwards = updateConfront(
      { boundRequires: [{ id: "ev-letter", label: "Finds the letter" }] },
      { requires: ["Finds the letter"] },
    );
    expect(outOfOrderWarnings(backwards, lines, chapters)).toEqual([
      "“Finds the letter” would come after this event.",
    ]);
    // Moved after its prerequisite, the order is fine.
    expect(outOfOrderWarnings(moveAndRequire, lines, chapters)).toEqual([]);
  });

  it("refuses a chapter or requirement name the agent did not bind", () => {
    const parse = (change: object) => storyChangeSchema.safeParse(change);
    expect(parse(moveAndRequire).success).toBe(true);
    expect(parse({ ...moveAndRequire, boundChapter: undefined }).success).toBe(
      false,
    );
    expect(
      parse({
        ...moveAndRequire,
        boundRequires: [{ id: "ev-rumour", label: "Rumour spreads" }],
      }).success,
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
