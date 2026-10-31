import React, { useEffect, useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
  type ResponderProvided,
} from "@hello-pangea/dnd";
import type { Character, Place } from "@novelsync/story-data-client";
import type { PlotEvent, PlotLine } from "@/types/IPlot";
import type { EventSaveStatus } from "../eventSaveQueue";
import { lineSaveState } from "../eventSaveQueue";
import { chapterFor, type ChapterOption } from "../plotChapters";
import type { PlotGrouping } from "../plotView";
import { type CardMenuItem, EventCard } from "./EventCard";
import { OutlineSection } from "./OutlineSection";
import {
  countEvents,
  filterLines,
  groupByChapter,
  groupByPlotLine,
  isFiltering,
  type OutlineSection as Section,
  type PlotFilter,
} from "./outlineGroups";
import { PlotFilters } from "./PlotFilters";
import {
  describeMove,
  type MoveAction,
  planMove,
  sectionName,
  type Spot,
} from "./moves";

interface OutlineViewProps {
  storyId: string;
  group: PlotGrouping;
  lines: PlotLine[];
  /** The cache, including events hidden by a pending delete. */
  rawLines: PlotLine[];
  chapters: ChapterOption[];
  characters: Character[];
  places: Place[];
  statuses: ReadonlyMap<string, EventSaveStatus>;
  highlightedEventId: string | null;
  onChange: (lineId: string, event: PlotEvent) => void;
  /** Edit and delete; the move items are added here. */
  menuFor: (line: PlotLine, event: PlotEvent) => CardMenuItem[];
  onMove: (action: MoveAction) => void;
  onAssignChapter: (line: PlotLine, event: PlotEvent) => void;
  onMoveToLine: (line: PlotLine, event: PlotEvent) => void;
  onAddEvent: (lineId: string, chapterId: string | null) => void;
  onAddPlotLine: () => void;
  onEditLine: (line: PlotLine) => void;
  onDeleteLine: (line: PlotLine) => void;
}

const chapterTag = (chapters: ChapterOption[], id: string | null) => {
  const chapter = chapterFor(chapters, id);
  return chapter ? `Ch ${chapter.label}` : "No chapter";
};

function collapsedKey(storyId: string, group: PlotGrouping) {
  return `tale-tribe:plot-collapsed:${storyId}:${group}`;
}

function readCollapsed(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
}

export const OutlineView: React.FC<OutlineViewProps> = ({
  storyId,
  group,
  lines,
  rawLines,
  chapters,
  characters,
  places,
  statuses,
  highlightedEventId,
  onChange,
  menuFor,
  onMove,
  onAssignChapter,
  onMoveToLine,
  onAddEvent,
  onAddPlotLine,
  onEditLine,
  onDeleteLine,
}) => {
  const [filter, setFilter] = useState<PlotFilter>({});
  const key = collapsedKey(storyId, group);
  const [collapsed, setCollapsed] = useState(() => readCollapsed(key));
  const [collapsedFor, setCollapsedFor] = useState(key);
  if (collapsedFor !== key) {
    setCollapsedFor(key);
    setCollapsed(readCollapsed(key));
  }
  const [announcement, setAnnouncement] = useState("");
  const [refocus, setRefocus] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const toggle = (section: string) => {
    const next = new Set(collapsed);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    setCollapsed(next);
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
      // Not remembered without storage; the toggle still works.
    }
  };

  const filtering = isFiltering(filter);
  const shownLines = useMemo(() => filterLines(lines, filter), [lines, filter]);
  const sections = useMemo(
    () =>
      group === "chapters"
        ? groupByChapter(shownLines, chapters)
        : groupByPlotLine(shownLines),
    [group, shownLines, chapters],
  );

  // After a menu move the card may have remounted in another section; put
  // focus back on its menu button once the menu has closed.
  useEffect(() => {
    if (!refocus) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`plot-event-${refocus}-menu`)?.focus();
      setRefocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [refocus, sections]);

  const move = (from: Spot, to: Spot): string | null => {
    const action = planMove(sections, from, to, rawLines);
    if (action.kind === "none") return null;
    onMove(action);
    const target = sections.find((s) => s.key === to.key)!;
    return describeMove(target, to.index, from.key === to.key);
  };

  const menuMove = (eventId: string, from: Spot, to: Spot) => {
    const message = move(from, to);
    if (message) setAnnouncement(message);
    setRefocus(eventId);
  };

  const onDragEnd = (result: DropResult, provided: ResponderProvided) => {
    setDragging(false);
    if (!result.destination) return;
    const message = move(
      { key: result.source.droppableId, index: result.source.index },
      {
        key: result.destination.droppableId,
        index: result.destination.index,
      },
    );
    if (message) provided.announce(message);
  };

  const cardMenu = (
    section: Section,
    index: number,
    line: PlotLine,
    event: PlotEvent,
  ): CardMenuItem[] => {
    const here = { key: section.key, index };
    const ordered = section.kind !== "unassigned";
    return [
      {
        label: "Move up",
        disabled: !ordered || index === 0,
        onSelect: () =>
          menuMove(event.id, here, { key: section.key, index: index - 1 }),
      },
      {
        label: "Move down",
        disabled: !ordered || index === section.items.length - 1,
        onSelect: () =>
          menuMove(event.id, here, { key: section.key, index: index + 1 }),
      },
      {
        label: "Assign chapter…",
        separated: true,
        onSelect: () => onAssignChapter(line, event),
      },
      {
        label: "Move to plot line…",
        disabled: lines.length < 2,
        onSelect: () => onMoveToLine(line, event),
      },
      ...menuFor(line, event).map((item, i) =>
        i === 0 ? { ...item, separated: true } : item,
      ),
    ];
  };

  return (
    <div className="space-y-3">
      <PlotFilters
        filter={filter}
        onChange={setFilter}
        lines={lines}
        characters={characters}
        places={places}
        shown={countEvents(shownLines)}
        total={countEvents(lines)}
      />
      {filtering && (
        <p className="font-ui text-xs text-ns-ink-muted">
          Dragging is off while filtering. Clear the filters to drag, or use an
          event's menu to move it.
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <DragDropContext
        onDragStart={() => setDragging(true)}
        onDragEnd={onDragEnd}
      >
        {sections.map((section) => (
          <Droppable key={section.key} droppableId={section.key}>
            {(drop, dropState) => (
              <div
                className={`rounded-ns-lg transition-colors ${
                  dropState.isDraggingOver ? "ring-2 ring-ns-accent" : ""
                }`}
              >
                <OutlineSection
                  section={section}
                  collapsed={
                    collapsed.has(section.key) &&
                    // A section holding the event an "Open in Plot" link points at opens.
                    !section.items.some(
                      ({ event }) => event.id === highlightedEventId,
                    )
                  }
                  onToggle={() => toggle(section.key)}
                  lines={lines}
                  lineFailed={
                    section.kind === "line" &&
                    ["error", "conflict"].includes(
                      lineSaveState(statuses, section.line.id) ?? "",
                    )
                  }
                  onAddEvent={onAddEvent}
                  onAddPlotLine={onAddPlotLine}
                  onEditLine={onEditLine}
                  onDeleteLine={onDeleteLine}
                  collapsedDrop={
                    <div
                      ref={drop.innerRef}
                      {...drop.droppableProps}
                      aria-label={`Drop into ${sectionName(section)}`}
                      className={`mx-3 mb-2 rounded-ns ${
                        dragging
                          ? "min-h-[2.5rem] border border-dashed border-ns-border-strong"
                          : "min-h-[0.25rem]"
                      }`}
                    >
                      {drop.placeholder}
                    </div>
                  }
                >
                  <div
                    ref={drop.innerRef}
                    {...drop.droppableProps}
                    className="space-y-2 min-h-[0.5rem]"
                  >
                    {section.items.map(({ line, event }, index) => (
                      <Draggable
                        key={event.id}
                        draggableId={event.id}
                        index={index}
                        isDragDisabled={filtering}
                      >
                        {(drag, dragState) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className={
                              dragState.isDragging
                                ? "shadow-ns-lg rounded-ns-lg"
                                : ""
                            }
                          >
                            <EventCard
                              event={event}
                              tag={
                                group === "chapters"
                                  ? line.name || "Untitled plot line"
                                  : chapterTag(chapters, event.chapterId)
                              }
                              characters={characters}
                              places={places}
                              saveState={statuses.get(event.id)?.state}
                              highlighted={highlightedEventId === event.id}
                              onChange={(next) => onChange(line.id, next)}
                              menu={cardMenu(section, index, line, event)}
                              handle={
                                filtering ? undefined : (
                                  <span
                                    {...drag.dragHandleProps}
                                    aria-label={`Drag ${event.name || "event"} to move it`}
                                    className="flex-shrink-0 -ml-1 w-6 min-h-[44px] flex items-center justify-center rounded-ns text-ns-ink-muted hover:text-ns-ink cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
                                  >
                                    <GripVertical
                                      className="w-4 h-4"
                                      aria-hidden
                                    />
                                  </span>
                                )
                              }
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {drop.placeholder}
                  </div>
                </OutlineSection>
              </div>
            )}
          </Droppable>
        ))}
      </DragDropContext>
    </div>
  );
};
