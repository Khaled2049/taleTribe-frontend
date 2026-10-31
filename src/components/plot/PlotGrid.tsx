import React from "react";
import {
  Droppable,
  Draggable,
  type DroppableProvided,
  type DroppableStateSnapshot,
  type DraggableProvided,
  type DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { GripVertical, MapPin, PlusCircle, Users } from "lucide-react";
import type { Character, Place } from "@novelsync/story-data-client";
import type { PlotEvent, PlotEventStatus, PlotLine } from "@/types/IPlot";
import {
  STORY_BEAT_OPTIONS,
  PACING_OPTIONS,
  STATUS_OPTIONS,
} from "./plotOptions";
import { ChapterSelect } from "./ChapterSelect";
import type { ChapterOption } from "./plotChapters";
import type { EventSaveStatus } from "./eventSaveQueue";
import { type CardMenuItem, EventMenu } from "./outline/EventMenu";
import {
  type ColumnDef,
  type ColumnId,
  gridTemplate,
  minRowWidth,
  RAIL_PX,
} from "./grid/plotColumns";

const failed = (states: ReadonlyMap<string, EventSaveStatus>, id: string) => {
  const state = states.get(id)?.state;
  return state === "error" || state === "conflict";
};

// Tension color — semantic heat map, always shown beside the number.
function getTensionColor(level: number): string {
  if (level <= 3) return "bg-emerald-500";
  if (level <= 5) return "bg-amber-500";
  if (level <= 7) return "bg-orange-500";
  return "bg-rose-500";
}

interface PlotGridProps {
  plotLine: PlotLine;
  columns: ColumnDef[];
  onUpdateEvent: (event: PlotEvent) => void;
  onAddEvent: () => void;
  menuFor: (event: PlotEvent, index: number) => CardMenuItem[];
  chapters: ChapterOption[];
  characters: Character[];
  places: Place[];
  saveStates: ReadonlyMap<string, EventSaveStatus>;
  highlightedEventId?: string | null;
}

const cellInput =
  "w-full bg-transparent px-2 py-1.5 font-ui text-sm text-ns-ink placeholder-ns-ink-muted focus:outline-none focus:bg-ns-surface rounded-ns transition-colors";
const cellSelectBase =
  "w-full bg-transparent px-1.5 py-1.5 font-ui text-xs text-ns-ink focus:outline-none focus:bg-ns-surface rounded-ns transition-colors cursor-pointer";
const headerCell =
  "px-2 py-2 font-ui text-[10px] font-semibold uppercase tracking-widest text-white/90 border-r border-white/15 flex items-center";
const fieldsGrid =
  "grid grid-cols-1 md:[grid-template-columns:var(--plot-columns)]";
const centered = new Set<ColumnId>(["tension", "menu"]);

// One cell of the grid. On mobile it renders as a labelled stacked row; on
// md+ the label is hidden and it becomes a borderless column cell.
const Field: React.FC<{
  label: string;
  center?: boolean;
  children: React.ReactNode;
}> = ({ label, center, children }) => (
  <div className="flex items-start md:items-center gap-2 px-3 py-2 md:px-1.5 md:py-1.5 border-b border-ns-border md:border-b-0 md:border-r last:border-b-0 md:last:border-r-0">
    <span className="md:hidden flex-shrink-0 w-24 pt-1.5 font-ui text-[10px] font-semibold uppercase tracking-wide text-ns-ink-muted">
      {label}
    </span>
    <div
      className={`flex-1 min-w-0 ${center ? "md:flex md:justify-center" : ""}`}
    >
      {children}
    </div>
  </div>
);

const PlotGrid: React.FC<PlotGridProps> = ({
  plotLine,
  columns,
  onUpdateEvent,
  onAddEvent,
  menuFor,
  chapters,
  characters,
  places,
  saveStates,
  highlightedEventId,
}) => {
  const layout = {
    "--plot-columns": gridTemplate(columns),
  } as React.CSSProperties;

  const cell = (id: ColumnId, event: PlotEvent, index: number) => {
    const name = event.name || "event";
    switch (id) {
      case "event":
        return (
          <input
            value={event.name}
            onChange={(e) => onUpdateEvent({ ...event, name: e.target.value })}
            aria-label="Event name"
            placeholder="Event…"
            className={`${cellInput} font-medium`}
          />
        );
      case "content":
        return (
          <textarea
            value={event.content}
            onChange={(e) =>
              onUpdateEvent({ ...event, content: e.target.value })
            }
            aria-label={`What happens in ${name}`}
            placeholder="What happens…"
            rows={2}
            className={`${cellInput} resize-none leading-snug [field-sizing:content] max-h-[10.5rem] overflow-y-auto`}
          />
        );
      case "chapter":
        return (
          <ChapterSelect
            chapters={chapters}
            value={event.chapterId}
            onChange={(chapterId) => onUpdateEvent({ ...event, chapterId })}
            aria-label={`Chapter for ${name}`}
            className={cellSelectBase}
          />
        );
      case "time":
        return (
          <input
            value={event.timeConstraint?.timeGap ?? ""}
            onChange={(e) => {
              const timeGap = e.target.value;
              onUpdateEvent({
                ...event,
                timeConstraint: timeGap
                  ? {
                      ...(event.timeConstraint ?? {
                        type: "relative" as const,
                      }),
                      timeGap,
                    }
                  : undefined,
              });
            }}
            aria-label={`Time of ${name}`}
            placeholder="When…"
            className={cellInput}
          />
        );
      case "tension":
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${getTensionColor(event.tensionLevel)}`}
              aria-hidden
            />
            <input
              type="number"
              min={1}
              max={10}
              value={event.tensionLevel}
              aria-label={`Tension of ${name}, 1 to 10`}
              onChange={(e) =>
                onUpdateEvent({
                  ...event,
                  tensionLevel: Math.min(
                    10,
                    Math.max(1, Number(e.target.value) || 1),
                  ),
                })
              }
              className="w-12 bg-transparent px-1 py-1.5 font-ui text-sm text-ns-ink text-center tabular-nums focus:outline-none focus:bg-ns-surface rounded-ns"
            />
          </div>
        );
      case "status":
        return (
          <select
            value={event.status}
            aria-label={`Status of ${name}`}
            onChange={(e) =>
              onUpdateEvent({
                ...event,
                status: e.target.value as PlotEventStatus,
              })
            }
            className={cellSelectBase}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case "pacing":
        return (
          <select
            value={event.pacing}
            aria-label={`Pacing of ${name}`}
            onChange={(e) =>
              onUpdateEvent({
                ...event,
                pacing: e.target.value as PlotEvent["pacing"],
              })
            }
            className={`${cellSelectBase} capitalize`}
          >
            {PACING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case "beat":
        return (
          <select
            value={event.storyBeat}
            aria-label={`Beat of ${name}`}
            onChange={(e) =>
              onUpdateEvent({
                ...event,
                storyBeat: e.target.value as PlotEvent["storyBeat"],
              })
            }
            className={cellSelectBase}
          >
            {STORY_BEAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case "cast": {
        const cast = characters.filter((c) =>
          event.characterIds.includes(c.id),
        );
        const place = places.find((p) => p.id === event.locationId);
        if (!cast.length && !place) {
          return (
            <span className="px-2 font-ui text-xs text-ns-ink-muted">—</span>
          );
        }
        return (
          <div className="px-2 space-y-0.5 font-ui text-xs text-ns-ink-secondary min-w-0">
            {cast.length > 0 && (
              <p
                className="flex items-center gap-1 truncate"
                title={cast.map((c) => c.name).join(", ")}
              >
                <Users className="w-3 h-3 flex-shrink-0" aria-hidden />
                <span className="sr-only">Characters:</span>
                <span className="truncate">
                  {cast.map((c) => c.name).join(", ")}
                </span>
              </p>
            )}
            {place && (
              <p
                className="flex items-center gap-1 truncate"
                title={place.name}
              >
                <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden />
                <span className="sr-only">Location:</span>
                <span className="truncate">{place.name}</span>
              </p>
            )}
          </div>
        );
      }
      case "menu":
        return (
          <EventMenu
            eventId={event.id}
            eventName={event.name || "Untitled event"}
            items={menuFor(event, index)}
          />
        );
    }
  };

  return (
    <div
      className="border border-ns-border rounded-ns-lg overflow-hidden shadow-ns-sm bg-ns-elevated"
      style={layout}
    >
      <div className="overflow-x-auto">
        <div
          className="md:[min-width:var(--plot-min-width)]"
          style={
            {
              "--plot-min-width": `${minRowWidth(columns)}px`,
            } as React.CSSProperties
          }
        >
          {/* ── Header row (md+ only) ── */}
          <div className="hidden md:flex bg-ns-accent text-white sticky top-0 z-10">
            <div
              className="flex-shrink-0 border-r border-white/15"
              style={{ width: RAIL_PX }}
            />
            <div className={`flex-1 ${fieldsGrid}`}>
              {columns.map((column, i) => (
                <div
                  key={column.id}
                  className={`${headerCell} ${centered.has(column.id) ? "justify-center" : ""} ${
                    i === columns.length - 1 ? "border-r-0" : ""
                  }`}
                >
                  {column.id === "menu" ? (
                    <span className="sr-only">{column.label}</span>
                  ) : (
                    column.label
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Rows ── */}
          <Droppable droppableId={plotLine.id}>
            {(
              provided: DroppableProvided,
              droppableSnapshot: DroppableStateSnapshot,
            ) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`transition-colors duration-150 ${
                  droppableSnapshot.isDraggingOver
                    ? "bg-ns-accent-subtle"
                    : "bg-ns-elevated"
                }`}
              >
                {plotLine.events.length === 0 ? (
                  <div className="flex items-center justify-center h-20 font-ui text-xs text-ns-ink-muted">
                    No events yet — click "Add row" to create one
                  </div>
                ) : (
                  plotLine.events.map((event, index) => (
                    <Draggable
                      key={event.id}
                      draggableId={event.id}
                      index={index}
                    >
                      {(
                        dragProvided: DraggableProvided,
                        dragSnapshot: DraggableStateSnapshot,
                      ) => (
                        <div
                          id={`plot-event-${event.id}`}
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          style={dragProvided.draggableProps.style}
                          className={`flex border-b border-ns-border transition-colors ${
                            dragSnapshot.isDragging
                              ? "shadow-ns-xl ring-1 ring-ns-accent bg-ns-elevated"
                              : "hover:bg-ns-surface-hover"
                          } ${
                            failed(saveStates, event.id)
                              ? "ring-1 ring-inset ring-ns-destructive"
                              : highlightedEventId === event.id
                                ? "bg-ns-accent-subtle"
                                : ""
                          }`}
                        >
                          {/* Left rail: drag handle + index */}
                          <div
                            className="flex-shrink-0 flex md:flex-col items-center justify-center gap-1 md:gap-0.5 py-2 md:py-0 border-r border-ns-border text-ns-ink-muted"
                            style={{ width: RAIL_PX }}
                          >
                            <span
                              {...dragProvided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing hover:text-ns-ink"
                              aria-label={`Drag ${event.name || "event"} to reorder`}
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-ui text-[10px] tabular-nums">
                              {index + 1}
                            </span>
                          </div>

                          <div className={`flex-1 min-w-0 ${fieldsGrid}`}>
                            {columns.map((column) => (
                              <Field
                                key={column.id}
                                label={column.label}
                                center={centered.has(column.id)}
                              >
                                {cell(column.id, event, index)}
                              </Field>
                            ))}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* ── Add row ── */}
          <button
            onClick={onAddEvent}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 font-ui text-xs font-medium text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-accent transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add row
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlotGrid;
