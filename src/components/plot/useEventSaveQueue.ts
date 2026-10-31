import { useMemo, useSyncExternalStore } from "react";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { storyWorldbuildingRepo } from "@novelsync/story-data-client";
import { queryKeys } from "@/hooks/queries/queryKeys";
import type { PlotLine } from "@/types/IPlot";
import { EventSaveQueue, type EventSaveStatus } from "./eventSaveQueue";

// Module-level so a queue outlives the component that started a save: leaving
// the Plot tab mid-save must not drop it, and other views share the same queue.
const queues = new WeakMap<QueryClient, Map<string, EventSaveQueue>>();

export function eventSaveQueueFor(
  queryClient: QueryClient,
  storyId: string,
): EventSaveQueue {
  let byStory = queues.get(queryClient);
  if (!byStory) queues.set(queryClient, (byStory = new Map()));
  let queue = byStory.get(storyId);
  if (!queue) {
    queue = new EventSaveQueue({
      send: (lineId, event) =>
        storyWorldbuildingRepo.updateEvent(storyId, lineId, event),
      applySaved: (lineId, saved, revisionOnly) =>
        queryClient.setQueryData<PlotLine[]>(
          queryKeys.plots.byStory(storyId),
          (old) =>
            (old ?? []).map((line) =>
              line.id !== lineId
                ? line
                : {
                    ...line,
                    events: line.events.map((event) =>
                      event.id !== saved.id
                        ? event
                        : revisionOnly
                          ? { ...event, revision: saved.revision }
                          : saved,
                    ),
                  },
            ),
        ),
    });
    byStory.set(storyId, queue);
  }
  return queue;
}

const EMPTY: ReadonlyMap<string, EventSaveStatus> = new Map();
const noop = () => () => {};

export function useEventSaveQueue(storyId: string | undefined) {
  const queryClient = useQueryClient();
  const queue = useMemo(
    () => (storyId ? eventSaveQueueFor(queryClient, storyId) : null),
    [queryClient, storyId],
  );
  const statuses = useSyncExternalStore(
    queue?.subscribe ?? noop,
    queue?.getSnapshot ?? (() => EMPTY),
  );
  return { queue, statuses };
}
