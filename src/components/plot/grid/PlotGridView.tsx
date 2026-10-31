import React from "react";
import { Pencil, Trash2 } from "lucide-react";
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
  onChange: (lineId: string, event: PlotEvent) => void;
  onDeleteEvent: (lineId: string, eventId: string) => void;
  onAddEvent: (lineId: string) => void;
  onOpenEditor: (lineId: string, event: PlotEvent) => void;
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
  onChange,
  onDeleteEvent,
  onAddEvent,
  onOpenEditor,
  onEditLine,
  onDeleteLine,
  onRetry,
  onReload,
  onDragEnd,
}) => {
  const active = lines.find((line) => line.id === activeLineId) ?? null;
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
              onUpdateEvent={(event) => onChange(active.id, event)}
              onDeleteEvent={(id) => onDeleteEvent(active.id, id)}
              onAddEvent={() => onAddEvent(active.id)}
              onOpenEditor={(event) => onOpenEditor(active.id, event)}
              chapters={chapters}
              saveStates={statuses}
              highlightedEventId={highlightedEventId}
            />
          </DragDropContext>
        </div>
      )}
    </>
  );
};
