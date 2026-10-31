import React, { useEffect, useMemo, useState } from "react";
import { Book, ChevronDown, PlusCircle, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { PlotLineEditModal } from "./PlotlineEditModal";
import { EventEditModal } from "./EventEditModal";
import PlotGrid from "./PlotGrid";
import {
  PlotEvent,
  PlotLine,
  TemplateData,
  DEFAULT_PLOT_EVENT_VALUES,
  PLOT_TEMPLATES,
} from "@/types/IPlot";
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
import {
  type EventSaveState,
  eventsInState,
  lineSaveState,
} from "./eventSaveQueue";
import { SaveIndicator } from "./SaveIndicator";
import { EVENT_UNDO_MS, usePlotLines } from "./usePlotLines";
import { plotLineDeleteLabel, plotLineDeleteText } from "./plotDeleteCopy";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { storyWorldbuildingRepo } from "@novelsync/story-data-client";
import { chapterOptions } from "./plotChapters";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";

const failedLine = (state: EventSaveState | null) =>
  state === "error" || state === "conflict";

const PlotTimeline: React.FC = () => {
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

  const templates: TemplateData[] = PLOT_TEMPLATES;
  const [isPlotLineModalOpen, setisPlotLineModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingPlotLine, setEditingPlotLine] = useState<PlotLine | null>(null);
  const [editingEvent, setEditingEvent] = useState<{
    plotLineId: string;
    event: PlotEvent;
  } | null>(null);

  const [activePlotLineId, setActivePlotLineId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
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
    setSearchParams({}, { replace: true });
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

  const addEvent = (plotLineId: string) => {
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

  const retrySaves = (plotLineId: string) =>
    queue?.retry(eventsInState(statuses, plotLineId, "error"));

  // Drops the conflicting local edits and takes the server's copy.
  const reloadConflicts = (plotLineId: string) => {
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

  const addPlotLineFromTemplate = async (template: TemplateData) => {
    if (!storyId || !user) {
      console.error("No storyId or user provided");
      return;
    }

    try {
      const plotLine = await addPlotLineMutation.mutateAsync(template.name);

      // Sequential: each addEvent is an arrayUnion on the same document.
      for (const [idx, e] of template.events.entries()) {
        await addEventMutation.mutateAsync({
          plotLineId: plotLine.id,
          event: {
            ...DEFAULT_PLOT_EVENT_VALUES,
            content: e.content,
            name: e.name,
            orderIndex: idx,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: user.uid,
          },
        });
      }

      setActivePlotLineId(plotLine.id);
    } catch (error) {
      console.error("Error adding plot line from template:", error);
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

  const activePlotLine =
    plotLines.find((pl) => pl.id === activePlotLineId) ?? null;

  return (
    <div className="h-full flex flex-col bg-ns-bg">
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-ns-border bg-ns-surface overflow-x-auto">
        {/* Page title */}
        <span className="font-heading italic text-lg text-ns-ink mr-2 hidden sm:block">
          Plot Grid
        </span>

        <div className="w-px h-5 bg-ns-border hidden sm:block" />

        <button
          onClick={addPlotLine}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ns-accent text-white font-ui text-xs font-medium rounded-ns hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Add Plot Line
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="inline-flex items-center gap-1.5 h-auto px-3 py-1.5 bg-transparent border border-ns-border text-ns-ink-secondary font-ui text-xs font-normal rounded-ns hover:bg-ns-surface-hover hover:text-ns-ink transition-all duration-150 shadow-none"
            >
              <Book className="w-3.5 h-3.5" />
              Templates
              <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border border-ns-border bg-ns-elevated shadow-ns-lg rounded-ns-lg p-1 min-w-[200px]">
            {templates.map((template, idx) => (
              <DropdownMenuItem
                key={idx}
                onSelect={() => addPlotLineFromTemplate(template)}
                className="px-3 py-2 hover:bg-ns-surface-hover rounded-ns cursor-pointer font-ui text-sm text-ns-ink"
              >
                <span className="font-heading italic">{template.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-4 max-w-6xl mx-auto">
          {plotLines.length === 0 ? (
            /* Empty state */
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
          ) : (
            <>
              {/* Plot line switcher */}
              <div className="flex items-center gap-1 overflow-x-auto border-b border-ns-border">
                {plotLines.map((pl) => {
                  const active = pl.id === activePlotLineId;
                  return (
                    <button
                      key={pl.id}
                      onClick={() => setActivePlotLineId(pl.id)}
                      className={`inline-flex items-center gap-2 px-3 py-2 font-ui text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                        active
                          ? "border-ns-accent text-ns-accent font-medium"
                          : "border-transparent text-ns-ink-secondary hover:text-ns-ink"
                      }`}
                    >
                      <span className="font-heading italic">{pl.name}</span>
                      <span className="font-ui text-[10px] tabular-nums opacity-60">
                        {pl.events.length}
                      </span>
                      {failedLine(lineSaveState(statuses, pl.id)) && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-ns-destructive"
                          title="Some changes in this plot line didn't save"
                        >
                          <span className="sr-only">
                            Some changes in this plot line didn't save
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {activePlotLine && (
                <div className="space-y-3">
                  {/* Active plot line header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-heading italic text-lg text-ns-ink truncate">
                        {activePlotLine.name}
                      </h3>
                      {activePlotLine.description && (
                        <p className="font-ui text-xs text-ns-ink-secondary truncate">
                          {activePlotLine.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <SaveIndicator
                        state={lineSaveState(statuses, activePlotLine.id)}
                        onRetry={() => retrySaves(activePlotLine.id)}
                        onReload={() => reloadConflicts(activePlotLine.id)}
                      />
                      <button
                        onClick={() => openEditPlotlineModal(activePlotLine)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-ns border border-ns-border text-ns-ink-secondary font-ui text-xs hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Details
                      </button>
                      <button
                        onClick={() => setPlotLineToDelete(activePlotLine)}
                        className="p-1.5 rounded-ns border border-ns-border text-ns-ink-muted hover:text-ns-destructive hover:bg-ns-surface-hover transition-colors"
                        aria-label="Delete plot line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Grid */}
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <PlotGrid
                      plotLine={activePlotLine}
                      onUpdateEvent={(ev) =>
                        updateEventInline(activePlotLine.id, ev)
                      }
                      onDeleteEvent={(id) => deleteEvent(activePlotLine.id, id)}
                      onAddEvent={() => addEvent(activePlotLine.id)}
                      onOpenEditor={(ev) =>
                        openEditEventModal(activePlotLine.id, ev)
                      }
                      chapters={chapters}
                      saveStates={statuses}
                      highlightedEventId={highlightedEventId}
                    />
                  </DragDropContext>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
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

export default PlotTimeline;
