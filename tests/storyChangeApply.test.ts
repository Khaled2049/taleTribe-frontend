import { describe, expect, it, vi } from "vitest";
import type { ThreadMessage } from "@assistant-ui/react";
import {
  buildRunRequest,
  proposeStoryChangesSchema,
  type ProposeStoryChangesArgs,
  type StoryChange,
} from "@novelsync/assistant-contracts";
import {
  StoryDataConflictError,
  type Character,
  type Place,
  type PlotLine,
} from "@novelsync/story-data-client";
import { entityContinuationForMessage } from "@/components/chat/assistantRuntime";
import { EditorActionLedger } from "@/components/chat/editorActionLedger";
import {
  allApplied,
  applyStoryChanges,
  isStale,
  type StoryChangeRepo,
} from "@/components/chat/storyChangeApply";

const mina: Character = {
  id: "char-1",
  name: "Mina",
  personality: "Guarded.",
  backstory: "Raised on the marsh.",
  relationships: [
    { characterId: "char-2", name: "Tobias", type: "rival", description: "" },
  ],
  userId: "uid-1",
  revision: 4,
};
const lampRoom: Place = {
  id: "place-1",
  name: "The Lamp Room",
  userId: "uid-1",
  revision: 2,
};
const wreck: PlotLine = {
  id: "plot-1",
  name: "The Wreck",
  description: "",
  revision: 1,
  events: [
    {
      id: "event-1",
      name: "The storm",
      content: "Rain.",
      characterIds: ["char-1"],
      locationId: null,
      dependencies: [],
      dependents: [],
      tensionLevel: 4,
      pacing: "slow",
      storyBeat: "rising_action",
      orderIndex: 0,
      revision: 7,
    },
  ],
};

function fakeRepo(overrides: Record<string, unknown> = {}) {
  const repo = {
    getCharacters: vi.fn(async () => [mina]),
    addCharacter: vi.fn(async (_s: string, x: object) => ({
      ...(x as Character),
      id: "char-new",
    })),
    updateCharacter: vi.fn(async (_s: string, x: Character) => x),
    getPlaces: vi.fn(async () => [lampRoom]),
    addPlace: vi.fn(async (_s: string, x: object) => ({
      ...(x as Place),
      id: "place-new",
    })),
    updatePlace: vi.fn(async (_s: string, x: Place) => x),
    getPlots: vi.fn(async () => [wreck]),
    addPlot: vi.fn(async (_s: string, name: string, description = "") => ({
      id: "plot-new",
      name,
      description,
      events: [],
    })),
    updatePlotMeta: vi.fn(async (_s: string, x: PlotLine) => x),
    addEvent: vi.fn(async (_s: string, _l: string, x: object) => ({
      ...(x as PlotLine["events"][number]),
      id: "event-new",
    })),
    updateEvent: vi.fn(
      async (_s: string, _l: string, x: PlotLine["events"][number]) => x,
    ),
    ...overrides,
  };
  return repo;
}

const updateMina: StoryChange = {
  operation: "character.update",
  entityId: "char-1",
  fields: { personality: "Guarded, then reckless." },
  baseRevision: 4,
  label: "Mina",
};
const createHospital: StoryChange = {
  operation: "place.create",
  fields: { name: "Abandoned Hospital", atmosphere: "Damp." },
  label: "Abandoned Hospital",
};

const proposalOf = (...changes: StoryChange[]): ProposeStoryChangesArgs => ({
  summary: "Sharpen the cast.",
  changes,
});

describe("applying an approved story proposal", () => {
  it("overlays only the proposed fields onto the full current record", async () => {
    const repo = fakeRepo();
    const results = await applyStoryChanges(
      "story-1",
      proposalOf(updateMina),
      repo as unknown as StoryChangeRepo,
    );

    expect(allApplied(results)).toBe(true);
    const sent = repo.updateCharacter.mock.calls[0][1];
    expect(sent.personality).toBe("Guarded, then reckless.");
    // The whole-record replace must not blank what the proposal did not name.
    expect(sent.backstory).toBe("Raised on the marsh.");
    expect(sent.relationships).toEqual(mina.relationships);
    expect(sent.revision).toBe(4);
  });

  it("refuses an update whose target moved since the draft", async () => {
    const repo = fakeRepo({
      getCharacters: vi.fn(async () => [{ ...mina, revision: 5 }]),
    });
    const results = await applyStoryChanges(
      "story-1",
      proposalOf(updateMina, createHospital),
      repo as unknown as StoryChangeRepo,
    );

    expect(results).toEqual([
      { index: 0, status: "stale" },
      { index: 1, status: "skipped" },
    ]);
    expect(repo.updateCharacter).not.toHaveBeenCalled();
    expect(repo.addPlace).not.toHaveBeenCalled();
  });

  it("reports a server-side revision conflict as stale", async () => {
    const repo = fakeRepo({
      updateCharacter: vi.fn(async () => {
        throw new StoryDataConflictError();
      }),
    });
    const [result] = await applyStoryChanges(
      "story-1",
      proposalOf(updateMina),
      repo as unknown as StoryChangeRepo,
    );
    expect(result.status).toBe("stale");
  });

  it("stops at the first failure and says what already landed", async () => {
    const repo = fakeRepo({
      updateCharacter: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const results = await applyStoryChanges(
      "story-1",
      proposalOf(createHospital, updateMina, {
        ...createHospital,
        fields: { name: "The Morgue" },
        label: "The Morgue",
      }),
      repo as unknown as StoryChangeRepo,
    );
    expect(results.map((result) => result.status)).toEqual([
      "applied",
      "failed",
      "skipped",
    ]);
    expect(results[0].entityId).toBe("place-new");
    expect(repo.addPlace).toHaveBeenCalledTimes(1);
  });

  it("does not create the same entity twice after a reload", async () => {
    const repo = fakeRepo({
      getPlaces: vi.fn(async () => [
        lampRoom,
        { ...lampRoom, id: "place-2", name: "abandoned hospital" },
      ]),
    });
    const [result] = await applyStoryChanges(
      "story-1",
      proposalOf(createHospital),
      repo as unknown as StoryChangeRepo,
    );
    expect(result.status).toBe("stale");
    expect(repo.addPlace).not.toHaveBeenCalled();
  });

  it("creates an event at the end of its line with board defaults", async () => {
    const repo = fakeRepo();
    await applyStoryChanges(
      "story-1",
      proposalOf({
        operation: "event.create",
        plotLineId: "plot-1",
        fields: { name: "Landfall", tensionLevel: 8 },
        label: "Landfall",
      }),
      repo as unknown as StoryChangeRepo,
    );
    expect(repo.addEvent.mock.calls[0][2]).toMatchObject({
      name: "Landfall",
      tensionLevel: 8,
      pacing: "moderate",
      storyBeat: "rising_action",
      orderIndex: 1,
      characterIds: [],
    });
  });

  it("keeps an event's other fields on update", async () => {
    const repo = fakeRepo();
    await applyStoryChanges(
      "story-1",
      proposalOf({
        operation: "event.update",
        entityId: "event-1",
        plotLineId: "plot-1",
        fields: { tensionLevel: 9 },
        baseRevision: 7,
        label: "The storm",
      }),
      repo as unknown as StoryChangeRepo,
    );
    expect(repo.updateEvent.mock.calls[0][2]).toMatchObject({
      content: "Rain.",
      characterIds: ["char-1"],
      tensionLevel: 9,
    });
  });
});

describe("staleness shown on the card", () => {
  it("separates stale from not-yet-loaded and from a cache that is behind", () => {
    expect(isStale(updateMina, { characters: [mina] })).toBe(false);
    expect(isStale(updateMina, {})).toBeUndefined();
    expect(
      isStale(updateMina, { characters: [{ ...mina, revision: 5 }] }),
    ).toBe(true);
    expect(
      isStale(updateMina, { characters: [{ ...mina, revision: 3 }] }),
    ).toBeUndefined();
    expect(isStale(updateMina, { characters: [] })).toBe(true);
    expect(isStale(createHospital, {})).toBe(false);
  });
});

describe("story-change contracts", () => {
  it("rejects fields outside the allowlist and oversized proposals", () => {
    expect(
      proposeStoryChangesSchema.safeParse(
        proposalOf({
          ...updateMina,
          fields: { artUrl: "https://example.com/x.png" } as never,
        }),
      ).success,
    ).toBe(false);
    expect(
      proposeStoryChangesSchema.safeParse(
        proposalOf(...Array.from({ length: 6 }, () => createHospital)),
      ).success,
    ).toBe(false);
  });
});

function pausedMessage(approved: boolean): ThreadMessage {
  const proposal = proposalOf(updateMina, createHospital);
  return {
    role: "assistant",
    status: { type: "requires-action", reason: "tool-calls" },
    content: [
      {
        type: "tool-call",
        toolCallId: "call-1",
        toolName: "propose_story_changes",
        args: proposal,
        argsText: JSON.stringify(proposal),
        result: { proposalId: "proposal-1" },
      },
      {
        type: "tool-call",
        toolCallId: "apply-1",
        toolName: "apply_story_changes",
        args: { proposalId: "proposal-1" },
        argsText: '{"proposalId":"proposal-1"}',
        approval: { id: "approval-1", approved },
      },
    ],
    metadata: { custom: { novelsync: { runId: "run-1" } } },
  } as unknown as ThreadMessage;
}

describe("story-change continuation", () => {
  it("carries the proposal, linkage and per-change results", () => {
    const ledger = new EditorActionLedger();
    ledger.resolve("approval-1", {
      decision: "apply_failed",
      results: [
        { index: 0, status: "applied", entityId: "char-1" },
        { index: 1, status: "failed" },
      ],
    });
    const continuation = entityContinuationForMessage(
      pausedMessage(true),
      ledger,
    );
    expect(continuation).toMatchObject({
      kind: "entity_approval",
      previousRunId: "run-1",
      approvalId: "approval-1",
      toolCallId: "apply-1",
      proposalId: "proposal-1",
      decision: "apply_failed",
    });
    expect(continuation?.results).toHaveLength(2);

    const request = buildRunRequest({
      storyId: "story-1",
      text: "ok",
      clientMessageId: "m-1",
      continuation,
    });
    expect(request.continuation).toMatchObject({ kind: "entity_approval" });
  });

  it("fails closed when the approval has no recorded browser decision", () => {
    expect(() =>
      entityContinuationForMessage(
        pausedMessage(true),
        new EditorActionLedger(),
      ),
    ).toThrow(/resumed safely/);
  });

  it("ignores messages with no story-change approval", () => {
    const message = pausedMessage(true);
    const content = message.content.slice(0, 1);
    expect(
      entityContinuationForMessage(
        { ...message, content } as ThreadMessage,
        new EditorActionLedger(),
      ),
    ).toBeUndefined();
  });
});
