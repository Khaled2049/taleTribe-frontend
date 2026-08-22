import React from "react";
import {
  Droppable,
  Draggable,
  type DroppableProvided,
  type DroppableStateSnapshot,
  type DraggableProvided,
  type DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import {
  GripVertical,
  PlusCircle,
  Trash2,
  Settings2,
  Users,
  MapPin,
} from "lucide-react";
import { PlotEvent, PlotLine } from "@/types/IPlot";
import { STORY_BEAT_OPTIONS, PACING_OPTIONS } from "./plotOptions";

// Tension color — semantic heat map
function getTensionColor(level: number): string {
  if (level <= 3) return "bg-emerald-500";
  if (level <= 5) return "bg-amber-500";
  if (level <= 7) return "bg-orange-500";
  return "bg-rose-500";
}

// Field column tracks for the md+ spreadsheet layout (excludes the left
// rail). Below md the fields stack into a single labelled column.
const FIELDS_COLS =
  "md:[grid-template-columns:minmax(150px,1.3fr)_minmax(240px,2.4fr)_70px_130px_84px_124px_158px_96px]";

interface PlotGridProps {
  plotLine: PlotLine;
  onUpdateEvent: (event: PlotEvent) => void;
  onDeleteEvent: (eventId: string) => void;
  onAddEvent: () => void;
  onOpenEditor: (event: PlotEvent) => void;
}

const cellInput =
  "w-full bg-transparent px-2 py-1.5 font-ui text-sm text-ns-ink placeholder-ns-ink-muted focus:outline-none focus:bg-ns-surface rounded-ns transition-colors";
const cellSelect =
  "w-full bg-transparent px-1.5 py-1.5 font-ui text-xs text-ns-ink focus:outline-none focus:bg-ns-surface rounded-ns transition-colors cursor-pointer capitalize";
const headerCell =
  "px-2 py-2 font-ui text-[10px] font-semibold uppercase tracking-widest text-white/90 border-r border-white/15 flex items-center";

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
  onUpdateEvent,
  onDeleteEvent,
  onAddEvent,
  onOpenEditor,
}) => {
  const updateTime = (event: PlotEvent, timeGap: string) => {
    const timeConstraint = timeGap
      ? { ...(event.timeConstraint ?? { type: "relative" as const }), timeGap }
      : undefined;
    onUpdateEvent({ ...event, timeConstraint });
  };

  return (
    <div className="border border-ns-border rounded-ns-lg overflow-hidden shadow-ns-sm bg-ns-elevated">
      <div className="overflow-x-auto">
        <div className="md:min-w-[1080px]">
          {/* ── Header row (md+ only) ── */}
          <div className="hidden md:flex bg-ns-accent text-white sticky top-0 z-10">
            <div className="w-11 flex-shrink-0 border-r border-white/15" />
            <div className={`flex-1 grid ${FIELDS_COLS}`}>
              <div className={headerCell}>Plot point</div>
              <div className={headerCell}>Main plot</div>
              <div className={`${headerCell} justify-center`}>Ch.</div>
              <div className={headerCell}>Time</div>
              <div className={`${headerCell} justify-center`}>Tension</div>
              <div className={headerCell}>Pacing</div>
              <div className={headerCell}>Beat</div>
              <div className={`${headerCell} justify-center border-r-0`}>
                Actions
              </div>
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
                    No plot points yet — click "Add row" to create one
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
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          style={dragProvided.draggableProps.style}
                          className={`flex border-b border-ns-border transition-colors ${
                            dragSnapshot.isDragging
                              ? "shadow-ns-xl ring-1 ring-ns-accent bg-ns-elevated"
                              : "hover:bg-ns-surface-hover"
                          }`}
                        >
                          {/* Left rail: drag handle + index */}
                          <div className="w-11 flex-shrink-0 flex md:flex-col items-center justify-center gap-1 md:gap-0.5 py-2 md:py-0 border-r border-ns-border text-ns-ink-muted">
                            <span
                              {...dragProvided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing hover:text-ns-ink"
                              aria-label="Drag to reorder"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-ui text-[10px] tabular-nums">
                              {index + 1}
                            </span>
                          </div>

                          {/* Fields */}
                          <div
                            className={`flex-1 min-w-0 grid grid-cols-1 ${FIELDS_COLS}`}
                          >
                            <Field label="Plot point">
                              <input
                                value={event.name}
                                onChange={(e) =>
                                  onUpdateEvent({
                                    ...event,
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Plot point…"
                                className={`${cellInput} font-medium`}
                              />
                            </Field>

                            <Field label="Main plot">
                              <textarea
                                value={event.content}
                                onChange={(e) =>
                                  onUpdateEvent({
                                    ...event,
                                    content: e.target.value,
                                  })
                                }
                                placeholder="What happens here…"
                                rows={2}
                                className={`${cellInput} resize-none leading-snug`}
                              />
                            </Field>

                            <Field label="Chapter" center>
                              <input
                                type="number"
                                min={1}
                                value={event.chapterNumber ?? ""}
                                onChange={(e) =>
                                  onUpdateEvent({
                                    ...event,
                                    chapterNumber: e.target.value
                                      ? Number(e.target.value)
                                      : undefined,
                                  })
                                }
                                placeholder="—"
                                className={`${cellInput} md:text-center tabular-nums md:w-16`}
                              />
                            </Field>

                            <Field label="Time">
                              <input
                                value={event.timeConstraint?.timeGap ?? ""}
                                onChange={(e) =>
                                  updateTime(event, e.target.value)
                                }
                                placeholder="When…"
                                className={cellInput}
                              />
                            </Field>

                            <Field label="Tension" center>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full flex-shrink-0 ${getTensionColor(
                                    event.tensionLevel,
                                  )}`}
                                />
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={event.tensionLevel}
                                  onChange={(e) =>
                                    onUpdateEvent({
                                      ...event,
                                      tensionLevel: Math.min(
                                        10,
                                        Math.max(
                                          1,
                                          Number(e.target.value) || 1,
                                        ),
                                      ),
                                    })
                                  }
                                  className="w-12 bg-transparent px-1 py-1.5 font-ui text-sm text-ns-ink text-center tabular-nums focus:outline-none focus:bg-ns-surface rounded-ns"
                                />
                              </div>
                            </Field>

                            <Field label="Pacing">
                              <select
                                value={event.pacing}
                                onChange={(e) =>
                                  onUpdateEvent({
                                    ...event,
                                    pacing: e.target
                                      .value as PlotEvent["pacing"],
                                  })
                                }
                                className={cellSelect}
                              >
                                {PACING_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Beat">
                              <select
                                value={event.storyBeat}
                                onChange={(e) =>
                                  onUpdateEvent({
                                    ...event,
                                    storyBeat: e.target
                                      .value as PlotEvent["storyBeat"],
                                  })
                                }
                                className={cellSelect}
                              >
                                {STORY_BEAT_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Actions" center>
                              <div className="flex items-center gap-1">
                                {event.characterIds.length > 0 && (
                                  <span className="inline-flex items-center gap-0.5 font-ui text-[10px] text-ns-accent">
                                    <Users className="w-3 h-3" />
                                    {event.characterIds.length}
                                  </span>
                                )}
                                {event.locationId && (
                                  <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                )}
                                <button
                                  onClick={() => onOpenEditor(event)}
                                  className="p-1 rounded-ns text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface transition-colors"
                                  aria-label="Open full editor"
                                  title="Characters, location, dependencies…"
                                >
                                  <Settings2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onDeleteEvent(event.id)}
                                  className="p-1 rounded-ns text-ns-ink-muted hover:text-ns-destructive hover:bg-ns-surface transition-colors"
                                  aria-label="Delete plot point"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </Field>
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
