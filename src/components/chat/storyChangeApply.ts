import type {
  ProposeStoryChangesArgs,
  StoryChange,
  StoryChangeResult,
} from "@novelsync/assistant-contracts";
import {
  StoryDataConflictError,
  type Character,
  type Place,
  type PlotEvent,
  type PlotLine,
  type StoryWorldbuildingRepo,
} from "@novelsync/story-data-client";

export type StoryChangeKind = "character" | "place" | "plot" | "event";

/** The slice of the worldbuilding repo an apply needs; narrow so tests can fake it. */
export type StoryChangeRepo = Pick<
  StoryWorldbuildingRepo,
  | "getCharacters"
  | "addCharacter"
  | "updateCharacter"
  | "getPlaces"
  | "addPlace"
  | "updatePlace"
  | "getPlots"
  | "addPlot"
  | "updatePlotMeta"
  | "addEvent"
  | "updateEvent"
>;

export type StorySnapshot = {
  characters?: Character[];
  places?: Place[];
  plots?: PlotLine[];
};

export const changeKind = (change: StoryChange): StoryChangeKind =>
  change.operation.split(".")[0] as StoryChangeKind;

export const isCreate = (change: StoryChange): boolean =>
  change.operation.endsWith(".create");

/** The record an update targets, as it stands in `snapshot`, if it exists. */
export function currentTarget(
  change: StoryChange,
  snapshot: StorySnapshot,
): Character | Place | PlotLine | PlotEvent | undefined {
  if (isCreate(change)) return undefined;
  switch (changeKind(change)) {
    case "character":
      return snapshot.characters?.find((x) => x.id === change.entityId);
    case "place":
      return snapshot.places?.find((x) => x.id === change.entityId);
    case "plot":
      return snapshot.plots?.find((x) => x.id === change.entityId);
    case "event":
      return snapshot.plots
        ?.find((x) => x.id === change.plotLineId)
        ?.events.find((x) => x.id === change.entityId);
  }
}

/**
 * Whether an update still targets the revision it was drafted against.
 * `undefined` means the snapshot has not loaded, which is not the same as stale.
 */
export function isStale(
  change: StoryChange,
  snapshot: StorySnapshot,
): boolean | undefined {
  if (isCreate(change)) return false;
  const loaded =
    changeKind(change) === "character"
      ? snapshot.characters
      : changeKind(change) === "place"
        ? snapshot.places
        : snapshot.plots;
  if (!loaded) return undefined;
  const target = currentTarget(change, snapshot);
  if (!target) return true;
  const base = change.baseRevision ?? 0;
  // A cached copy older than the draft is behind, not stale; it will refetch.
  if ((target.revision ?? 0) < base) return undefined;
  return target.revision !== base;
}

class StaleChange extends Error {}

// A create whose name is already taken has most likely been applied already
// (a reload between the save and its acknowledgement), so it must not repeat.
function assertNameFree(rows: { name: string }[], name: string) {
  const wanted = name.trim().toLowerCase();
  if (rows.some((row) => row.name.trim().toLowerCase() === wanted)) {
    throw new StaleChange();
  }
}

async function applyOne(
  storyId: string,
  change: StoryChange,
  repo: StoryChangeRepo,
): Promise<string> {
  const fields = change.fields;
  const kind = changeKind(change);
  const name = fields.name ?? change.label;

  // story-data replaces the whole record on update, so every update starts
  // from a fresh read and overlays only the proposed fields. Sending the
  // fields alone would blank the rest, relationships included.
  if (kind === "character") {
    if (isCreate(change)) {
      assertNameFree(await repo.getCharacters(storyId), name);
      const created = await repo.addCharacter(storyId, {
        ...fields,
        name,
        relationships: [],
        userId: "",
      } as Omit<Character, "id" | "revision">);
      return created.id;
    }
    const characters = await repo.getCharacters(storyId);
    const current = currentTarget(change, { characters }) as
      Character | undefined;
    if (!current || current.revision !== change.baseRevision) {
      throw new StaleChange();
    }
    return (await repo.updateCharacter(storyId, { ...current, ...fields })).id;
  }

  if (kind === "place") {
    if (isCreate(change)) {
      assertNameFree(await repo.getPlaces(storyId), name);
      const created = await repo.addPlace(storyId, {
        ...fields,
        name,
        userId: "",
      } as Omit<Place, "id" | "revision">);
      return created.id;
    }
    const places = await repo.getPlaces(storyId);
    const current = currentTarget(change, { places }) as Place | undefined;
    if (!current || current.revision !== change.baseRevision) {
      throw new StaleChange();
    }
    return (await repo.updatePlace(storyId, { ...current, ...fields })).id;
  }

  if (kind === "plot") {
    if (isCreate(change)) {
      assertNameFree(await repo.getPlots(storyId), name);
      const created = await repo.addPlot(
        storyId,
        name,
        fields.description ?? "",
      );
      return created.id;
    }
    const plots = await repo.getPlots(storyId);
    const current = currentTarget(change, { plots }) as PlotLine | undefined;
    if (!current || current.revision !== change.baseRevision) {
      throw new StaleChange();
    }
    const updated = await repo.updatePlotMeta(storyId, {
      ...current,
      name: fields.name ?? current.name,
      description: fields.description ?? current.description,
    });
    return updated.id;
  }

  const plots = await repo.getPlots(storyId);
  const line = plots.find((x) => x.id === change.plotLineId);
  if (!line) throw new StaleChange();
  if (isCreate(change)) {
    assertNameFree(line.events, name);
    const created = await repo.addEvent(storyId, line.id, {
      content: "",
      characterIds: [],
      locationId: null,
      dependencies: [],
      dependents: [],
      tensionLevel: 5,
      pacing: "moderate",
      storyBeat: "rising_action",
      orderIndex: line.events.length,
      ...fields,
      name,
    });
    return created.id;
  }
  const current = line.events.find((x) => x.id === change.entityId);
  if (!current || current.revision !== change.baseRevision) {
    throw new StaleChange();
  }
  return (await repo.updateEvent(storyId, line.id, { ...current, ...fields }))
    .id;
}

/**
 * Apply an approved proposal, one request per change.
 *
 * There is no batch endpoint, so this is not atomic: it stops at the first
 * change that does not save and reports the rest as skipped, so the writer and
 * the assistant both see exactly what landed.
 */
export async function applyStoryChanges(
  storyId: string,
  proposal: ProposeStoryChangesArgs,
  repo: StoryChangeRepo,
): Promise<StoryChangeResult[]> {
  const results: StoryChangeResult[] = [];
  let halted = false;
  for (const [index, change] of proposal.changes.entries()) {
    if (halted) {
      results.push({ index, status: "skipped" });
      continue;
    }
    try {
      const entityId = await applyOne(storyId, change, repo);
      results.push({ index, status: "applied", entityId });
    } catch (error) {
      halted = true;
      const stale =
        error instanceof StaleChange || error instanceof StoryDataConflictError;
      results.push({ index, status: stale ? "stale" : "failed" });
    }
  }
  return results;
}

export const allApplied = (results: StoryChangeResult[]): boolean =>
  results.every((result) => result.status === "applied");
