import React, { useMemo, useState } from "react";
import { Columns3, Pencil, Trash2 } from "lucide-react";
import type { Character, Place } from "@novelsync/story-data-client";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CardMenuItem } from "../outline/EventMenu";
import {
  type ColumnId,
  OPTIONAL_COLUMNS,
  rememberColumns,
  rememberedColumns,
  visibleColumns,
} from "./plotColumns";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import type { PlotEvent, PlotLine } from "@/types/IPlot";
import PlotGrid from "../PlotGrid";
import { SaveIndicator } from "../SaveIndicator";
import {
  type EventSaveState,
  type EventSaveStatus,
  lineSaveState,
} from "../eventSaveQueue";
import type { ChapterOption } from "../plotChapters";

const failedLine = (state: EventSaveState | null) =>
  state === "error" || state === "conflict";

interface PlotGridViewProps {
  lines: PlotLine[];
  activeLineId: string | null;
  onSelectLine: (lineId: string) => void;
  chapters: ChapterOption[];
  statuses: ReadonlyMap<string, EventSaveStatus>;
  highlightedEventId: string | null;
  characters: Character[];
  places: Place[];
  onChange: (lineId: string, event: PlotEvent) => void;
  onAddEvent: (lineId: string) => void;
  menuFor: (line: PlotLine, event: PlotEvent, index: number) => CardMenuItem[];
  onEditLine: (line: PlotLine) => void;
  onDeleteLine: (line: PlotLine) => void;
  onRetry: (lineId: string) => void;
  onReload: (lineId: string) => void;
  onDragEnd: (result: DropResult) => void;
}

/** The spreadsheet view: one plot line at a time, chosen from tabs. */
export const PlotGridView: React.FC<PlotGridViewProps> = ({
  lines,
  activeLineId,
  onSelectLine,
  chapters,
  statuses,
  highlightedEventId,
  characters,
  places,
  onChange,
  onAddEvent,
  menuFor,
  onEditLine,
  onDeleteLine,
  onRetry,
  onReload,
  onDragEnd,
}) => {
  const active = lines.find((line) => line.id === activeLineId) ?? null;
  const [chosen, setChosen] = useState<Set<ColumnId>>(rememberedColumns);
  const columns = useMemo(() => visibleColumns(chosen), [chosen]);
  const toggleColumn = (id: ColumnId) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
    rememberColumns(next);
  };
  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-ns-border">
        {lines.map((line) => {
          const selected = line.id === activeLineId;
          return (
            <button
              key={line.id}
              onClick={() => onSelectLine(line.id)}
              className={`inline-flex items-center gap-2 px-3 py-2 font-ui text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                selected
                  ? "border-ns-accent text-ns-accent font-medium"
                  : "border-transparent text-ns-ink-secondary hover:text-ns-ink"
              }`}
            >
              <span className="font-heading italic">{line.name}</span>
              <span className="font-ui text-[10px] tabular-nums opacity-60">
                {line.events.length}
              </span>
              {failedLine(lineSaveState(statuses, line.id)) && (
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

      {active && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-heading italic text-lg text-ns-ink truncate">
                {active.name}
              </h3>
              {active.description && (
                <p className="font-ui text-xs text-ns-ink-secondary truncate">
                  {active.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-ns border border-ns-border text-ns-ink-secondary font-ui text-xs hover:bg-ns-surface-hover hover:text-ns-ink transition-colors">
                  <Columns3 className="w-3.5 h-3.5" aria-hidden />
                  Columns
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="border border-ns-border bg-ns-elevated shadow-ns-lg rounded-ns-lg p-1 min-w-[220px]"
                >
                  <DropdownMenuLabel className="px-3 py-1.5 font-ui text-[10px] uppercase tracking-widest text-ns-ink-muted">
                    Extra columns
                  </DropdownMenuLabel>
                  {OPTIONAL_COLUMNS.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={chosen.has(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="font-ui text-sm text-ns-ink"
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <SaveIndicator
                state={lineSaveState(statuses, active.id)}
                onRetry={() => onRetry(active.id)}
                onReload={() => onReload(active.id)}
              />
              <button
                onClick={() => onEditLine(active)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-ns border border-ns-border text-ns-ink-secondary font-ui text-xs hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Details
              </button>
              <button
                onClick={() => onDeleteLine(active)}
                className="p-1.5 rounded-ns border border-ns-border text-ns-ink-muted hover:text-ns-destructive hover:bg-ns-surface-hover transition-colors"
                aria-label="Delete plot line"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <PlotGrid
              plotLine={active}
              columns={columns}
              onUpdateEvent={(event) => onChange(active.id, event)}
              onAddEvent={() => onAddEvent(active.id)}
              menuFor={(event, index) => menuFor(active, event, index)}
              chapters={chapters}
              characters={characters}
              places={places}
              saveStates={statuses}
              highlightedEventId={highlightedEventId}
            />
          </DragDropContext>
        </div>
      )}
    </>
  );
};
