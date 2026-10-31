import React, { useMemo } from "react";
import { AlertTriangle, ArrowUpRight, X } from "lucide-react";
import type { EventDependency, PlotEvent, PlotLine } from "@/types/IPlot";
import type { ChapterOption } from "./plotChapters";
import {
  comesLater,
  enabledBy,
  findEvent,
  manuscriptOrder,
  requirement,
  wouldLoop,
} from "./requirements";

interface RequirementsEditorProps {
  event: PlotEvent;
  lines: PlotLine[];
  chapters: ChapterOption[];
  onChange: (dependencies: EventDependency[]) => void;
  onOpenEvent?: (eventId: string) => void;
}

const labelClass =
  "block font-ui text-sm font-medium text-ns-ink-secondary mb-2";
const linkClass =
  "inline-flex items-center gap-0.5 font-ui text-xs text-ns-accent hover:underline";

export const RequirementsEditor: React.FC<RequirementsEditorProps> = ({
  event,
  lines,
  chapters,
  onChange,
  onOpenEvent,
}) => {
  const order = useMemo(
    () => manuscriptOrder(lines, chapters),
    [lines, chapters],
  );
  const required = new Set(event.dependencies.map((d) => d.eventId));
  const enables = enabledBy(lines, event.id);

  const add = (id: string) => {
    const target = findEvent(lines, id);
    if (!target || required.has(id)) return;
    onChange([...event.dependencies, requirement(target)]);
  };
  const remove = (id: string) =>
    onChange(event.dependencies.filter((d) => d.eventId !== id));
  const setIntentional = (id: string, outOfOrderOk: boolean) =>
    onChange(
      event.dependencies.map((d) =>
        d.eventId === id ? { ...d, outOfOrderOk } : d,
      ),
    );

  return (
    <div className="space-y-5">
      <div>
        <span className={labelClass}>Requires these events first</span>
        {event.dependencies.length === 0 ? (
          <p className="font-ui text-xs text-ns-ink-muted mb-2">
            Nothing yet. Add the events that have to happen before this one.
          </p>
        ) : (
          <ul className="space-y-2 mb-3">
            {event.dependencies.map((dependency) => {
              const target = findEvent(lines, dependency.eventId);
              const late = comesLater(order, dependency.eventId, event.id);
              const name = target?.event.name || "Untitled event";
              return (
                <li
                  key={dependency.eventId}
                  className="rounded-ns border border-ns-border bg-ns-surface px-3 py-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-ui text-sm text-ns-ink truncate">
                        {name}
                      </p>
                      <p className="font-ui text-[11px] text-ns-ink-muted truncate">
                        {target?.line.name || "Untitled plot line"}
                      </p>
                    </div>
                    {onOpenEvent && target && (
                      <button
                        type="button"
                        className={linkClass}
                        onClick={() => onOpenEvent(dependency.eventId)}
                      >
                        Open
                        <ArrowUpRight className="w-3 h-3" aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(dependency.eventId)}
                      aria-label={`Remove requirement ${name}`}
                      className="p-1 rounded-ns text-ns-ink-muted hover:text-ns-destructive hover:bg-ns-surface-hover"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {late && (
                    <div className="mt-2 space-y-1">
                      {!dependency.outOfOrderOk && (
                        <p className="flex items-center gap-1 font-ui text-xs text-ns-destructive">
                          <AlertTriangle
                            className="w-3.5 h-3.5 flex-shrink-0"
                            aria-hidden
                          />
                          Comes later in the manuscript
                        </p>
                      )}
                      <label className="flex items-center gap-2 font-ui text-xs text-ns-ink-secondary">
                        <input
                          type="checkbox"
                          checked={dependency.outOfOrderOk ?? false}
                          onChange={(e) =>
                            setIntentional(dependency.eventId, e.target.checked)
                          }
                          className="accent-ns-accent"
                        />
                        Intentional (flashback or reveal)
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <select
          aria-label="Add a requirement"
          value=""
          onChange={(e) => add(e.target.value)}
          className="w-full p-2 rounded-ns border border-ns-border bg-ns-surface font-ui text-sm text-ns-ink focus:outline-none focus:ring-2 focus:ring-ns-accent"
        >
          <option value="">Add a requirement…</option>
          {lines.map((line) => {
            const options = line.events.filter(
              (e) => e.id !== event.id && !required.has(e.id),
            );
            if (options.length === 0) return null;
            return (
              <optgroup key={line.id} label={line.name || "Untitled plot line"}>
                {options.map((candidate) => {
                  const loop = wouldLoop(lines, event.id, candidate.id);
                  return (
                    <option
                      key={candidate.id}
                      value={candidate.id}
                      disabled={loop}
                    >
                      {candidate.name || "Untitled event"}
                      {loop ? " (would make a loop)" : ""}
                    </option>
                  );
                })}
              </optgroup>
            );
          })}
        </select>
      </div>

      <div>
        <span className={labelClass}>Enables these events</span>
        {enables.length === 0 ? (
          <p className="font-ui text-xs text-ns-ink-muted">
            No event requires this one yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {enables.map(({ line, event: next }) => (
              <li
                key={next.id}
                className="flex items-center justify-between gap-2 font-ui text-sm"
              >
                <span className="min-w-0 truncate text-ns-ink">
                  {next.name || "Untitled event"}
                  <span className="text-ns-ink-muted"> · {line.name}</span>
                </span>
                {onOpenEvent && (
                  <button
                    type="button"
                    className={linkClass}
                    onClick={() => onOpenEvent(next.id)}
                  >
                    Open
                    <ArrowUpRight className="w-3 h-3" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
