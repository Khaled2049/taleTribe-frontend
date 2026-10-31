import { useMemo, useSyncExternalStore } from "react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { usePlots } from "@/hooks/queries/usePlotQueries";
import type { PlotEvent, PlotLine } from "@/types/IPlot";
import { DeferredDeletes } from "./deferredDeletes";
import { withLocalEdits } from "./eventSaveQueue";
import { useEventSaveQueue } from "./useEventSaveQueue";

export const EVENT_UNDO_MS = 6000;

// Module-level for the same reason as the save queue: an undo window outlives
// the page that opened it, and every view of the plan hides the same events.
const registry = new WeakMap<QueryClient, Map<string, DeferredDeletes>>();

function eventDeletesFor(queryClient: QueryClient, storyId: string) {
  let byStory = registry.get(queryClient);
  if (!byStory) registry.set(queryClient, (byStory = new Map()));
  let deletes = byStory.get(storyId);
  if (!deletes) byStory.set(storyId, (deletes = new DeferredDeletes()));
  return deletes;
}

const EMPTY: ReadonlySet<string> = new Set();
const noop = () => () => {};

/** Fetched plot lines as the writer should see them: unsaved edits applied, pending deletes hidden. */
export function visiblePlotLines(
  lines: PlotLine[],
  local: (eventId: string) => PlotEvent | null,
  hidden: ReadonlySet<string>,
): PlotLine[] {
  const edited = withLocalEdits(lines, local);
  if (hidden.size === 0) return edited;
  return edited.map((line) =>
    line.events.some((event) => hidden.has(event.id))
      ? { ...line, events: line.events.filter((e) => !hidden.has(e.id)) }
      : line,
  );
}

export function usePlotLines(storyId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: rawPlotLines, ...query } = usePlots(storyId);
  const { queue, statuses } = useEventSaveQueue(storyId);
  const deletes = useMemo(
    () => (storyId ? eventDeletesFor(queryClient, storyId) : null),
    [queryClient, storyId],
  );
  const hidden = useSyncExternalStore(
    deletes?.subscribe ?? noop,
    deletes?.getSnapshot ?? (() => EMPTY),
  );
  // Every event with a local value has a status, so `statuses` tracks them.
  const plotLines = useMemo(
    () =>
      visiblePlotLines(
        rawPlotLines ?? [],
        (id) => (statuses.has(id) ? (queue?.local(id) ?? null) : null),
        hidden,
      ),
    [rawPlotLines, queue, statuses, hidden],
  );
  return { plotLines, rawPlotLines, query, queue, statuses, deletes };
}
