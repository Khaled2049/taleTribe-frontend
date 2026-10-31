import React, { useEffect, useMemo, useState } from "react";
import { Book, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DropResult } from "@hello-pangea/dnd";

import { TemplatePreviewDialog } from "./TemplatePreviewDialog";

import { PlotLineEditModal } from "./PlotlineEditModal";
import { EventEditModal } from "./EventEditModal";
import { PlotGridView } from "./grid/PlotGridView";
import { OutlineView } from "./outline/OutlineView";
import { TensionChart } from "./shape/TensionChart";
import type { CardMenuItem } from "./outline/EventCard";
import { applyMove, type MoveAction } from "./outline/moves";
import { MoveEventDialog, type MoveTarget } from "./outline/MoveEventDialog";
import {
  type PlotViewState,
  rememberPlotView,
  rememberedPlotView,
  resolvePlotView,
} from "./plotView";
import { PlotEvent, PlotLine, DEFAULT_PLOT_EVENT_VALUES } from "@/types/IPlot";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queries/queryKeys";
import { useCharacters } from "@/hooks/queries/useCharacterQueries";
import { usePlaces } from "@/hooks/queries/usePlaceQueries";
import {
  useAddEvent,
  useAddPlotLine,
  useDeletePlotLine,
  useReorderEvents,
  useUpdatePlotLineMeta,
} from "@/hooks/queries/usePlotQueries";
import { workspaceChapterIndexQuery } from "@/hooks/queries/workspaceStory";
import { eventsInState, lineSaveState } from "./eventSaveQueue";
import { SaveIndicator } from "./SaveIndicator";
import { EVENT_UNDO_MS, usePlotLines } from "./usePlotLines";
import { plotLineDeleteLabel, plotLineDeleteText } from "./plotDeleteCopy";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import {
  StoryDataConflictError,
  storyWorldbuildingRepo,
} from "@novelsync/story-data-client";
import { chapterOptions } from "./plotChapters";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";

const segment = (active: boolean) =>
  `px-2.5 py-1 rounded-ns font-ui text-xs transition-colors ${
    active
      ? "bg-ns-elevated text-ns-ink font-medium shadow-ns-sm"
      : "text-ns-ink-secondary hover:text-ns-ink"
  }`;

const PlotWorkspace: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  // Characters and places come from the shared cache the Characters/Places pages
  // already populate — this page must not refetch them itself.
  const { data: characters = [] } = useCharacters(storyId);
  const { data: places = [] } = usePlaces(storyId);

  const addPlotLineMutation = useAddPlotLine(storyId);
  const updatePlotLineMeta = useUpdatePlotLineMeta(storyId);
  const deletePlotLineMutation = useDeletePlotLine(storyId);
  const addEventMutation = useAddEvent(storyId);
  const reorderEventsMutation = useReorderEvents(storyId);

  const { plotLines, rawPlotLines, queue, statuses, deletes, updateEvent } =
    usePlotLines(storyId);

  const { data: chapterIndex } = useQuery({
    ...workspaceChapterIndexQuery(user?.uid ?? "", storyId ?? ""),
    enabled: !!user?.uid && !!storyId,
  });
  const chapters = useMemo(() => chapterOptions(chapterIndex), [chapterIndex]);

  const [templateOpen, setTemplateOpen] = useState(false);
  const [isPlotLineModalOpen, setisPlotLineModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingPlotLine, setEditingPlotLine] = useState<PlotLine | null>(null);
  const [editingEvent, setEditingEvent] = useState<{
    plotLineId: string;
    event: PlotEvent;
  } | null>(null);

  const [activePlotLineId, setActivePlotLineId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { view, group } = resolvePlotView(searchParams, rememberedPlotView());
  const setViewState = (patch: Partial<PlotViewState>) => {
    const next = { view, group, ...patch };
    rememberPlotView(next);
    setSearchParams(
      (params) => {
        params.set("view", next.view);
        params.set("group", next.group);
        return params;
      },
      { replace: true },
    );
  };
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(
    null,
  );

  // "Open in Plot" from the editor lands here with ?line=&event=: select the
  // line, then scroll to and briefly mark the event. The params are consumed.
  const targetLine = searchParams.get("line");
  const targetEvent = searchParams.get("event");
  useEffect(() => {
    if (!targetLine || !plotLines.some((line) => line.id === targetLine)) {
      return;
    }
    setActivePlotLineId(targetLine);
    setHighlightedEventId(targetEvent);
    setSearchParams(
      (params) => {
        params.delete("line");
        params.delete("event");
        return params;
      },
      { replace: true },
    );
  }, [targetLine, targetEvent, plotLines, setSearchParams]);

  useEffect(() => {
    if (!highlightedEventId) return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById(`plot-event-${highlightedEventId}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
    const timer = setTimeout(() => setHighlightedEventId(null), 2500);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [highlightedEventId]);

  // Leaving the page sends debounced edits now rather than waiting out the timer.
  useEffect(() => () => queue?.flush(), [queue]);

  // Keep an active plotline selected as the list changes. Stands aside while
  // a ?line= target is being applied, or it would pick the first line over it.
  useEffect(() => {
    if (plotLines.length === 0) {
      setActivePlotLineId(null);
      return;
    }
    if (targetLine && plotLines.some((p) => p.id === targetLine)) return;
    if (
      !activePlotLineId ||
      !plotLines.some((p) => p.id === activePlotLineId)
    ) {
      setActivePlotLineId(plotLines[0].id);
    }
  }, [plotLines, activePlotLineId, targetLine]);

  const addPlotLine = async () => {
    if (!storyId) return;
    const plotLine = await addPlotLineMutation.mutateAsync("New PlotLine");
    setActivePlotLineId(plotLine.id);
  };

  const addEvent = (plotLineId: string, chapterId: string | null = null) => {
    if (!storyId || !user?.uid) return;

    const plotLine = plotLines.find((pl) => pl.id === plotLineId);
    const orderIndex = plotLine ? plotLine.events.length : 0;

    // No id here — plotService.addEvent mints it.
    addEventMutation.mutate({
      plotLineId,
      event: {
        ...DEFAULT_PLOT_EVENT_VALUES,
        name: "New Event",
        content: "",
        chapterId,
        orderIndex,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: user.uid,
      },
    });
  };

  const updateEventInline = (plotLineId: string, updatedEvent: PlotEvent) => {
    updateEvent(plotLineId, {
      ...updatedEvent,
      updatedAt: new Date().toISOString(),
    });
  };

  const retrySaves = (plotLineId?: string) =>
    queue?.retry(eventsInState(statuses, plotLineId, "error"));

  // Drops the conflicting local edits and takes the server's copy.
  const reloadConflicts = (plotLineId?: string) => {
    if (!storyId) return;
    for (const id of eventsInState(statuses, plotLineId, "conflict")) {
      queue?.discard(id);
    }
    queryClient.invalidateQueries({
      queryKey: queryKeys.plots.byStory(storyId),
    });
  };

  const [plotLineToDelete, setPlotLineToDelete] = useState<PlotLine | null>(
    null,
  );

  // The delete reaches the server only when the undo window closes; until then
  // the event is hidden, so Undo restores it with its links intact.
  const deleteEvent = (plotLineId: string, eventId: string) => {
    if (!storyId || !queue || !deletes) return;
    const name =
      plotLines
        .find((line) => line.id === plotLineId)
        ?.events.find((event) => event.id === eventId)?.name || "Event";
    const unsaved = queue.local(eventId);
    queue.discard(eventId);

    deletes.schedule(
      eventId,
      async () => {
        const key = queryKeys.plots.byStory(storyId);
        const revision = queryClient
          .getQueryData<PlotLine[]>(key)
          ?.find((line) => line.id === plotLineId)
          ?.events.find((event) => event.id === eventId)?.revision;
        try {
          const events = await storyWorldbuildingRepo.deleteEvent(
            storyId,
            plotLineId,
            eventId,
            revision,
          );
          queryClient.setQueryData<PlotLine[]>(key, (old) =>
            (old ?? []).map((line) =>
              line.id === plotLineId ? { ...line, events } : line,
            ),
          );
        } catch {
          toast.error(`Couldn't delete “${name}”. It's back in the list.`);
          await queryClient.invalidateQueries({ queryKey: key });
        }
      },
      EVENT_UNDO_MS,
    );

    toast(`Deleted “${name}”`, {
      duration: EVENT_UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          if (!deletes.undo(eventId)) return;
          if (unsaved) queue.schedule(plotLineId, unsaved);
        },
      },
    });
  };

  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);

  // Following a requirement link: select its line (for the grid), then scroll
  // to and mark the event, closing the dialog it was opened from.
  const openEvent = (eventId: string) => {
    const line = plotLines.find((l) => l.events.some((e) => e.id === eventId));
    if (!line) return;
    closeEditEventModal();
    setActivePlotLineId(line.id);
    setHighlightedEventId(eventId);
  };

  // Chapter reorders and line moves update the cache at once and roll back on
  // failure; the server's answer (every line) replaces it on success.
  const runMove = async (action: MoveAction) => {
    if (!storyId || action.kind === "none") return;
    if (action.kind === "unassign") {
      // The visible copy carries unsaved edits; the raw cache would drop them.
      const found = plotLines
        .flatMap((line) => line.events.map((event) => ({ line, event })))
        .find(({ event }) => event.id === action.eventId);
      if (found) assignChapter(found.line, found.event, null);
      return;
    }
    if (action.kind === "lineOrder") {
      reorderEventsMutation.mutate({
        plotLineId: action.lineId,
        orderedIds: action.orderedIds,
      });
      return;
    }

    const key = queryKeys.plots.byStory(storyId);
    const before = queryClient.getQueryData<PlotLine[]>(key);
    if (!before) return;
    await queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<PlotLine[]>(key, applyMove(before, action));
    try {
      let lines: PlotLine[];
      if (action.kind === "chapterOrder") {
        lines = await storyWorldbuildingRepo.reorderChapterEvents(
          storyId,
          action.chapterId,
          action.orderedIds,
          action.movedIn,
        );
        for (const { id } of action.movedIn) {
          queue?.relocate(id, undefined, { chapterId: action.chapterId });
        }
      } else {
        const from = before.find((l) => l.id === action.fromLineId);
        const to = before.find((l) => l.id === action.toLineId);
        const event = from?.events.find((e) => e.id === action.eventId);
        if (!from || !to || !event) throw new Error("Plot line is not loaded.");
        lines = await storyWorldbuildingRepo.moveEvent(
          storyId,
          from,
          event,
          to,
          action.toIndex,
        );
        queue?.relocate(action.eventId, action.toLineId);
      }
      queryClient.setQueryData<PlotLine[]>(key, lines);
    } catch (error) {
      queryClient.setQueryData<PlotLine[]>(key, before);
      if (error instanceof StoryDataConflictError) {
        toast.error("The plan changed somewhere else. It's been refreshed.");
        await queryClient.invalidateQueries({ queryKey: key });
      } else {
        toast.error("Couldn't move the event. It's back where it was.");
      }
    }
  };

  // Through the save queue like any edit; the server puts it at the end of the chapter.
  const assignChapter = (
    line: PlotLine,
    event: PlotEvent,
    chapterId: string | null,
  ) => {
    if (event.chapterId === chapterId) return;
    updateEvent(
      line.id,
      { ...event, chapterId, chapterPosition: null },
      { immediate: true },
    );
  };

  const moveToLine = (line: PlotLine, event: PlotEvent, toLineId: string) => {
    const to = plotLines.find((l) => l.id === toLineId);
    if (!to) return;
    void runMove({
      kind: "moveLine",
      fromLineId: line.id,
      toLineId,
      eventId: event.id,
      toIndex: to.events.length,
    });
  };

  const menuFor = (line: PlotLine, event: PlotEvent): CardMenuItem[] => [
    {
      label: "Edit details…",
      onSelect: () => openEditEventModal(line.id, event),
    },
    {
      label: "Delete",
      destructive: true,
      separated: true,
      onSelect: () => deleteEvent(line.id, event.id),
    },
  ];

  // The grid's row menu: the same actions as an outline card, ordered by plot line.
  const gridMenuFor = (
    line: PlotLine,
    event: PlotEvent,
    index: number,
  ): CardMenuItem[] => {
    const swap = (to: number) => {
      const ids = line.events.map((e) => e.id);
      ids.splice(index, 1);
      ids.splice(to, 0, event.id);
      void runMove({ kind: "lineOrder", lineId: line.id, orderedIds: ids });
    };
    return [
      {
        label: "Move up",
        disabled: index === 0,
        onSelect: () => swap(index - 1),
      },
      {
        label: "Move down",
        disabled: index === line.events.length - 1,
        onSelect: () => swap(index + 1),
      },
      {
        label: "Assign chapter…",
        separated: true,
        onSelect: () => setMoveTarget({ mode: "chapter", line, event }),
      },
      {
        label: "Move to plot line…",
        disabled: plotLines.length < 2,
        onSelect: () => setMoveTarget({ mode: "line", line, event }),
      },
      ...menuFor(line, event).map((item, i) =>
        i === 0 ? { ...item, separated: true } : item,
      ),
    ];
  };

  const confirmPlotLineDelete = async () => {
    const line = plotLineToDelete;
    if (!storyId || !line) return;
    // The cached line still holds events hidden by a pending delete; cancel
    // those too, or they'd fire against a plot line that no longer exists.
    const cached = rawPlotLines?.find((l) => l.id === line.id) ?? line;
    for (const event of cached.events) {
      queue?.discard(event.id);
      deletes?.undo(event.id);
    }
    try {
      await deletePlotLineMutation.mutateAsync({
        id: line.id,
        revision: line.revision,
      });
    } catch {
      toast.error(`Couldn't delete “${line.name}”. Please try again.`);
      return false;
    }
    setPlotLineToDelete(null);
  };

  const handleSavePlotLineModal = async () => {
    if (!storyId || !editingPlotLine) return;
    await updatePlotLineMeta.mutateAsync(editingPlotLine);
    closeEditPlotLineModal();
  };

  const handleSaveEvent = () => {
    if (!editingEvent) return;
    updateEvent(editingEvent.plotLineId, editingEvent.event, {
      immediate: true,
    });
    closeEditEventModal();
  };

  const openEditPlotlineModal = (plotLine: PlotLine) => {
    setEditingPlotLine(plotLine);
    setisPlotLineModalOpen(true);
  };

  const closeEditPlotLineModal = () => {
    setisPlotLineModalOpen(false);
    setEditingPlotLine(null);
  };

  const openEditEventModal = (plotLineId: string, event: PlotEvent) => {
    setEditingEvent({ plotLineId, event: { ...event } });
    setIsEventModalOpen(true);
  };

  const closeEditEventModal = () => {
    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  const createTemplate = async (
    destination:
      { kind: "new"; name: string } | { kind: "existing"; lineId: string },
    events: Omit<PlotEvent, "id" | "revision">[],
  ) => {
    if (!storyId) return;
    try {
      let firstEventId: string | null = null;
      if (destination.kind === "new") {
        const line = await storyWorldbuildingRepo.addPlotWithEvents(
          storyId,
          { name: destination.name },
          events,
        );
        setActivePlotLineId(line.id);
        firstEventId = line.events[0]?.id ?? null;
      } else {
        const created = await storyWorldbuildingRepo.addEvents(
          storyId,
          destination.lineId,
          events,
        );
        setActivePlotLineId(destination.lineId);
        firstEventId = created[0]?.id ?? null;
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.plots.byStory(storyId),
      });
      setViewState({ view: "outline", group: "lines" });
      setHighlightedEventId(firstEventId);
      toast.success("Template events created");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create template events",
      );
      throw error;
    }
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (source.droppableId !== destination.droppableId) return;

    const plotLineId = source.droppableId;
    const plotLine = plotLines.find((pl) => pl.id === plotLineId);
    if (!plotLine || !storyId) return;

    const orderedIds = plotLine.events.map((e) => e.id);
    const [removed] = orderedIds.splice(source.index, 1);
    orderedIds.splice(destination.index, 0, removed);

    reorderEventsMutation.mutate({ plotLineId, orderedIds });
  };

  return (
    <div className="h-full flex flex-col bg-ns-bg">
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-ns-border bg-ns-surface">
        <h2 className="font-heading italic text-lg text-ns-ink mr-1">Plot</h2>

        <div
          role="group"
          aria-label="View"
          className="inline-flex rounded-ns border border-ns-border bg-ns-bg p-0.5"
        >
          <button
            type="button"
            aria-pressed={view === "outline"}
            onClick={() => setViewState({ view: "outline" })}
            className={segment(view === "outline")}
          >
            Outline
          </button>
          <button
            type="button"
            aria-pressed={view === "grid"}
            onClick={() => setViewState({ view: "grid" })}
            className={segment(view === "grid")}
          >
            Grid
          </button>
          <button
            type="button"
            aria-pressed={view === "shape"}
            onClick={() => setViewState({ view: "shape" })}
            className={segment(view === "shape")}
          >
            Shape
          </button>
        </div>

        {view === "outline" && (
          <div
            role="group"
            aria-label="Group by"
            className="inline-flex items-center gap-1 rounded-ns border border-ns-border bg-ns-bg p-0.5"
          >
            <span className="pl-1.5 font-ui text-[11px] text-ns-ink-muted">
              By
            </span>
            <button
              type="button"
              aria-pressed={group === "chapters"}
              onClick={() => setViewState({ group: "chapters" })}
              className={segment(group === "chapters")}
            >
              Chapters
            </button>
            <button
              type="button"
              aria-pressed={group === "lines"}
              onClick={() => setViewState({ group: "lines" })}
              className={segment(group === "lines")}
            >
              Plot lines
            </button>
          </div>
        )}

        {view === "outline" && (
          <SaveIndicator
            state={lineSaveState(statuses)}
            onRetry={() => retrySaves()}
            onReload={() => reloadConflicts()}
          />
        )}

        <div className="flex-1" />

        <button
          onClick={addPlotLine}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ns-accent text-white font-ui text-xs font-medium rounded-ns hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Add Plot Line
        </button>

        <Button
          variant="outline"
          onClick={() => setTemplateOpen(true)}
          className="inline-flex items-center gap-1.5 h-auto px-3 py-1.5 bg-transparent border border-ns-border text-ns-ink-secondary font-ui text-xs font-normal rounded-ns hover:bg-ns-surface-hover hover:text-ns-ink transition-all duration-150 shadow-none"
        >
          <Book className="w-3.5 h-3.5" /> Templates
        </Button>
      </div>

      <TemplatePreviewDialog
        open={templateOpen}
        lines={plotLines}
        onClose={() => setTemplateOpen(false)}
        onCreate={createTemplate}
      />
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-4 max-w-6xl mx-auto">
          {plotLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 animate-ns-fade-in">
              <div className="w-16 h-16 rounded-full bg-ns-accent-subtle flex items-center justify-center">
                <Book className="w-7 h-7 text-ns-accent opacity-60" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-heading italic text-xl text-ns-ink-secondary">
                  No plot lines yet
                </p>
                <p className="font-ui text-sm text-ns-ink-muted">
                  Add a plot line or choose a template to structure your story
                </p>
              </div>
              <button
                onClick={addPlotLine}
                className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 bg-ns-accent text-white font-ui text-sm font-medium rounded-ns hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150 shadow-ns-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Add Plot Line
              </button>
            </div>
          ) : view === "shape" ? (
            <TensionChart
              lines={plotLines}
              chapters={chapters}
              onOpenEvent={(eventId) => {
                const line = plotLines.find((l) =>
                  l.events.some((e) => e.id === eventId),
                );
                const event = line?.events.find((e) => e.id === eventId);
                if (line && event) openEditEventModal(line.id, event);
              }}
              onShowUnassigned={() =>
                setViewState({ view: "outline", group: "chapters" })
              }
            />
          ) : view === "outline" && storyId ? (
            <OutlineView
              storyId={storyId}
              group={group}
              lines={plotLines}
              rawLines={rawPlotLines ?? []}
              chapters={chapters}
              characters={characters}
              places={places}
              statuses={statuses}
              highlightedEventId={highlightedEventId}
              onChange={updateEventInline}
              menuFor={menuFor}
              onMove={(action) => void runMove(action)}
              onAssignChapter={(line, event) =>
                setMoveTarget({ mode: "chapter", line, event })
              }
              onMoveToLine={(line, event) =>
                setMoveTarget({ mode: "line", line, event })
              }
              onAddEvent={addEvent}
              onAddPlotLine={addPlotLine}
              onEditLine={openEditPlotlineModal}
              onDeleteLine={setPlotLineToDelete}
              onOpenEvent={openEvent}
            />
          ) : (
            <PlotGridView
              lines={plotLines}
              activeLineId={activePlotLineId}
              onSelectLine={setActivePlotLineId}
              chapters={chapters}
              statuses={statuses}
              highlightedEventId={highlightedEventId}
              characters={characters}
              places={places}
              onChange={updateEventInline}
              onAddEvent={(lineId) => addEvent(lineId)}
              menuFor={gridMenuFor}
              onEditLine={openEditPlotlineModal}
              onDeleteLine={setPlotLineToDelete}
              onRetry={retrySaves}
              onReload={reloadConflicts}
              onDragEnd={handleDragEnd}
            />
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <MoveEventDialog
        target={moveTarget}
        onClose={() => setMoveTarget(null)}
        chapters={chapters}
        lines={plotLines}
        onAssignChapter={assignChapter}
        onMoveToLine={moveToLine}
      />
      <ConfirmDialog
        open={plotLineToDelete !== null}
        onOpenChange={(open) => !open && setPlotLineToDelete(null)}
        title={`Delete “${plotLineToDelete?.name ?? ""}”?`}
        description={plotLineDeleteText(plotLineToDelete?.events.length ?? 0)}
        confirmLabel={plotLineDeleteLabel(plotLineToDelete?.events.length ?? 0)}
        variant="danger"
        onConfirm={confirmPlotLineDelete}
      />

      <PlotLineEditModal
        isOpen={isPlotLineModalOpen}
        onClose={closeEditPlotLineModal}
        onSave={handleSavePlotLineModal}
        editingPlotLine={editingPlotLine}
        setEditingPlotLine={setEditingPlotLine}
      />

      <EventEditModal
        isOpen={isEventModalOpen}
        onClose={closeEditEventModal}
        onSave={handleSaveEvent}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEvent}
        characters={characters}
        places={places}
        chapters={chapters}
        lines={plotLines}
        onOpenEvent={openEvent}
      />
    </div>
  );
};

export default PlotWorkspace;
