import React from "react";
import { ChevronRight, MoreHorizontal, PlusCircle } from "lucide-react";
import type { PlotLine } from "@/types/IPlot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OutlineSection as Section } from "./outlineGroups";

interface OutlineSectionProps {
  section: Section;
  collapsed: boolean;
  onToggle: () => void;
  /** Every plot line, for choosing where a new event in a chapter goes. */
  lines: PlotLine[];
  /** Shows a dot when changes in this plot line didn't save. */
  lineFailed?: boolean;
  onAddEvent: (lineId: string, chapterId: string | null) => void;
  onAddPlotLine: () => void;
  onEditLine: (line: PlotLine) => void;
  onDeleteLine: (line: PlotLine) => void;
  /** Rendered in place of the body while collapsed, so it can still take a drop. */
  collapsedDrop?: React.ReactNode;
  children: React.ReactNode;
}

const menuClass =
  "border border-ns-border bg-ns-elevated shadow-ns-lg rounded-ns-lg p-1 min-w-[200px]";
const itemClass =
  "px-3 py-2 rounded-ns cursor-pointer font-ui text-sm text-ns-ink";
const addClass =
  "inline-flex items-center gap-1.5 px-2 py-1.5 rounded-ns font-ui text-xs font-medium text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-accent transition-colors";

export const OutlineSection: React.FC<OutlineSectionProps> = ({
  section,
  collapsed,
  onToggle,
  lines,
  lineFailed,
  onAddEvent,
  onAddPlotLine,
  onEditLine,
  onDeleteLine,
  collapsedDrop,
  children,
}) => {
  const bodyId = `outline-section-${section.key}`;
  const count = section.items.length;
  const title =
    section.kind === "chapter"
      ? section.chapter.label
      : section.kind === "line"
        ? section.line.name || "Untitled plot line"
        : "Unassigned events";
  const chapterId = section.kind === "chapter" ? section.chapter.id : null;

  const addEvent =
    section.kind === "line" ? (
      <button
        type="button"
        className={addClass}
        onClick={() => onAddEvent(section.line.id, null)}
      >
        <PlusCircle className="w-3.5 h-3.5" aria-hidden />
        Add event
      </button>
    ) : lines.length === 0 ? (
      <button type="button" className={addClass} onClick={onAddPlotLine}>
        <PlusCircle className="w-3.5 h-3.5" aria-hidden />
        Add a plot line first
      </button>
    ) : lines.length === 1 ? (
      <button
        type="button"
        className={addClass}
        onClick={() => onAddEvent(lines[0].id, chapterId)}
      >
        <PlusCircle className="w-3.5 h-3.5" aria-hidden />
        Add event
      </button>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger className={addClass}>
          <PlusCircle className="w-3.5 h-3.5" aria-hidden />
          Add event to…
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={menuClass}>
          <DropdownMenuLabel className="px-3 py-1.5 font-ui text-[10px] uppercase tracking-widest text-ns-ink-muted">
            Plot line
          </DropdownMenuLabel>
          {lines.map((line) => (
            <DropdownMenuItem
              key={line.id}
              className={itemClass}
              onSelect={() => onAddEvent(line.id, chapterId)}
            >
              {line.name || "Untitled plot line"}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  return (
    <section
      aria-labelledby={`${bodyId}-title`}
      className="rounded-ns-lg border border-ns-border bg-ns-surface"
    >
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <ChevronRight
            className={`w-4 h-4 flex-shrink-0 text-ns-ink-muted transition-transform ${
              collapsed ? "" : "rotate-90"
            }`}
            aria-hidden
          />
          <span className="min-w-0">
            <span
              id={`${bodyId}-title`}
              className={`block truncate text-ns-ink ${
                section.kind === "line"
                  ? "font-heading italic text-lg"
                  : "font-ui text-sm font-semibold"
              }`}
            >
              {title}
            </span>
            {section.kind === "line" && section.line.description && (
              <span className="block truncate font-ui text-xs text-ns-ink-secondary">
                {section.line.description}
              </span>
            )}
          </span>
          <span className="flex-shrink-0 font-ui text-[11px] tabular-nums text-ns-ink-muted">
            {count === 1 ? "1 event" : `${count} events`}
          </span>
          {lineFailed && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-ns-destructive flex-shrink-0"
              title="Some changes in this plot line didn't save"
            >
              <span className="sr-only">
                Some changes in this plot line didn't save
              </span>
            </span>
          )}
        </button>
        {section.kind === "line" && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${title}`}
              className="p-1.5 rounded-ns text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover"
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={menuClass}>
              <DropdownMenuItem
                className={itemClass}
                onSelect={() => onEditLine(section.line)}
              >
                Details…
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`${itemClass} text-ns-destructive`}
                onSelect={() => onDeleteLine(section.line)}
              >
                Delete plot line…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {collapsed && collapsedDrop}
      {!collapsed && (
        <div id={bodyId} className="px-3 pb-3 space-y-2">
          {children}
          {count === 0 && (
            <p className="px-1 py-2 font-ui text-xs text-ns-ink-muted">
              {section.kind === "chapter"
                ? "No events planned for this chapter."
                : "No events yet."}
            </p>
          )}
          <div>{addEvent}</div>
        </div>
      )}
    </section>
  );
};
