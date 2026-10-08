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

type Saved = { id: string };

/** Create the row, or update the target if it is still at its drafted revision. */
async function save<T extends { id: string; name: string; revision?: number }>(
  change: StoryChange,
  rows: T[],
  create: (name: string) => Promise<Saved>,
  update: (current: T) => Promise<Saved>,
): Promise<string> {
  if (isCreate(change)) {
    const name = change.fields.name ?? change.label;
    // The agent refuses to draft a create under a taken name, so a match here
    // is this create landing earlier (a reload before its acknowledgement).
    const wanted = name.trim().toLowerCase();
    const existing = rows.find(
      (row) => row.name.trim().toLowerCase() === wanted,
    );
    return existing ? existing.id : (await create(name)).id;
  }
  const current = rows.find((row) => row.id === change.entityId);
  if (!current || current.revision !== change.baseRevision) {
    throw new StaleChange();
  }
  return (await update(current)).id;
}

// story-data replaces the whole record on update, so every update starts from
// a fresh read and overlays only the proposed fields. Sending the fields alone
// would blank the rest, relationships included.
async function applyOne(
  storyId: string,
  change: StoryChange,
  repo: StoryChangeRepo,
): Promise<string> {
  const fields = change.fields;
  switch (changeKind(change)) {
    case "character":
      return save(
        change,
        await repo.getCharacters(storyId),
        (name) =>
          repo.addCharacter(storyId, {
            ...fields,
            name,
            relationships: [],
            userId: "",
          } as Omit<Character, "id" | "revision">),
        (current) => repo.updateCharacter(storyId, { ...current, ...fields }),
      );
    case "place":
      return save(
        change,
        await repo.getPlaces(storyId),
        (name) =>
          repo.addPlace(storyId, { ...fields, name, userId: "" } as Omit<
            Place,
            "id" | "revision"
          >),
        (current) => repo.updatePlace(storyId, { ...current, ...fields }),
      );
    case "plot":
      return save(
        change,
        await repo.getPlots(storyId),
        (name) => repo.addPlot(storyId, name, fields.description ?? ""),
        (current) =>
          repo.updatePlotMeta(storyId, {
            ...current,
            name: fields.name ?? current.name,
            description: fields.description ?? current.description,
          }),
      );
    case "event": {
      const plots = await repo.getPlots(storyId);
      const line = plots.find((x) => x.id === change.plotLineId);
      if (!line) throw new StaleChange();
      return save(
        change,
        line.events,
        (name) =>
          repo.addEvent(storyId, line.id, {
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
          }),
        (current) =>
          repo.updateEvent(storyId, line.id, { ...current, ...fields }),
      );
    }
  }
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
