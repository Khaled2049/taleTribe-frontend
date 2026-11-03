import React, { useEffect, useMemo, useState } from "react";
import { Book, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

import { TemplatePreviewDialog } from "./TemplatePreviewDialog";

import { PlotLineEditModal } from "./PlotlineEditModal";
import { EventEditModal } from "./EventEditModal";
import { OutlineView } from "./outline/OutlineView";
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
import { strongerConsequencePrompt } from "./assistantPrompts";
import { openAssistantWith } from "@/components/chat/assistantPrompt";
import { ASSISTANT_UI_ENABLED } from "@/config/featureFlags";
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

  const [searchParams, setSearchParams] = useSearchParams();
  const { group } = resolvePlotView(searchParams, rememberedPlotView());
  const setViewState = (next: PlotViewState) => {
    rememberPlotView(next);
    setSearchParams(
      (params) => {
        params.set("group", next.group);
        return params;
      },
      { replace: true },
    );
  };
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(
    null,
  );

  // "Open in Plot" from the editor lands here with ?line=&event=: scroll to and
  // briefly mark the event. The params are consumed.
  const targetLine = searchParams.get("line");
  const targetEvent = searchParams.get("event");
  useEffect(() => {
    if (!targetLine || !plotLines.some((line) => line.id === targetLine)) {
      return;
    }
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

  const addPlotLine = async () => {
    if (!storyId) return;
    const plotLine = await addPlotLineMutation.mutateAsync("New PlotLine");
    // An empty line has no chapter to sit under, so show the lines and name it.
    setViewState({ group: "lines" });
    openEditPlotlineModal(plotLine);
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
          queue.discard(eventId);
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
          deletes.undo(eventId);
        },
      },
    });
  };

  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);

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
    ...(ASSISTANT_UI_ENABLED && storyId
      ? [
          {
            label: "Suggest a stronger consequence",
            onSelect: () =>
              openAssistantWith({
                storyId,
                prompt: strongerConsequencePrompt(event.name, line.name),
              }),
          },
        ]
      : []),
    {
      label: "Delete",
      destructive: true,
      separated: true,
      onSelect: () => deleteEvent(line.id, event.id),
    },
  ];

  const confirmPlotLineDelete = async () => {
    const line = plotLineToDelete;
    if (!storyId || !line) return;
    // The cached line still holds events hidden by a pending delete. Keep
    // their queued edits until the server confirms that the line is gone.
    const cached = rawPlotLines?.find((l) => l.id === line.id) ?? line;
    try {
      await deletePlotLineMutation.mutateAsync({
        id: line.id,
        revision: line.revision,
      });
    } catch {
      toast.error(`Couldn't delete “${line.name}”. Please try again.`);
      return false;
    }
    for (const event of cached.events) {
      queue?.discard(event.id);
      deletes?.undo(event.id);
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
        firstEventId = line.events[0]?.id ?? null;
      } else {
        const created = await storyWorldbuildingRepo.addEvents(
          storyId,
          destination.lineId,
          events,
        );
        firstEventId = created[0]?.id ?? null;
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.plots.byStory(storyId),
      });
      setViewState({ group: "lines" });
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

  return (
    <div className="h-full flex flex-col bg-ns-bg">
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-ns-border bg-ns-surface">
        <h2 className="font-heading italic text-lg text-ns-ink mr-1">Plot</h2>

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

        <SaveIndicator
          state={lineSaveState(statuses)}
          onRetry={() => retrySaves()}
          onReload={() => reloadConflicts()}
        />

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
          ) : storyId ? (
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
              onAssignChapter={assignChapter}
              onMoveToLine={(line, event) => setMoveTarget({ line, event })}
              onAddEvent={addEvent}
              onAddPlotLine={addPlotLine}
              onEditLine={openEditPlotlineModal}
              onDeleteLine={setPlotLineToDelete}
            />
          ) : null}
        </div>
      </div>

      {/* ── Modals ── */}
      <MoveEventDialog
        target={moveTarget}
        onClose={() => setMoveTarget(null)}
        lines={plotLines}
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
      />
    </div>
  );
};

export default PlotWorkspace;
