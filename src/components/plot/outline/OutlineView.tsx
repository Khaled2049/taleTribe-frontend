import React, { useMemo, useState } from "react";
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
  type PlotFilter,
} from "./outlineGroups";
import { PlotFilters } from "./PlotFilters";

interface OutlineViewProps {
  storyId: string;
  group: PlotGrouping;
  lines: PlotLine[];
  chapters: ChapterOption[];
  characters: Character[];
  places: Place[];
  statuses: ReadonlyMap<string, EventSaveStatus>;
  highlightedEventId: string | null;
  onChange: (lineId: string, event: PlotEvent) => void;
  menuFor: (line: PlotLine, event: PlotEvent) => CardMenuItem[];
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
  chapters,
  characters,
  places,
  statuses,
  highlightedEventId,
  onChange,
  menuFor,
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

  const shownLines = useMemo(() => filterLines(lines, filter), [lines, filter]);
  const sections = useMemo(
    () =>
      group === "chapters"
        ? groupByChapter(shownLines, chapters)
        : groupByPlotLine(shownLines),
    [group, shownLines, chapters],
  );

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
      {sections.map((section) => (
        <OutlineSection
          key={section.key}
          section={section}
          collapsed={
            collapsed.has(section.key) &&
            // A section holding the event an "Open in Plot" link points at opens.
            !section.items.some(({ event }) => event.id === highlightedEventId)
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
        >
          {section.items.map(({ line, event }) => (
            <EventCard
              key={event.id}
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
              menu={menuFor(line, event)}
            />
          ))}
        </OutlineSection>
      ))}
    </div>
  );
};
