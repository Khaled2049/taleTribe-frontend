import React from "react";
import { ChevronDown } from "lucide-react";
import type { Character, Place } from "@novelsync/story-data-client";
import type { PlotEventStatus, PlotLine } from "@/types/IPlot";
import { STATUS_OPTIONS } from "../plotOptions";
import { type PlotFilter, isFiltering } from "./outlineGroups";

interface PlotFiltersProps {
  filter: PlotFilter;
  onChange: (filter: PlotFilter) => void;
  lines: PlotLine[];
  characters: Character[];
  places: Place[];
  shown: number;
  total: number;
}

const selectClass =
  "block min-w-0 max-w-[11rem] appearance-none rounded-ns border border-ns-border bg-ns-surface py-1 pl-2 pr-7 font-ui text-xs text-ns-ink focus:outline-none focus:ring-2 focus:ring-ns-accent dark:[color-scheme:dark]";

/** Native select with the arrow drawn inset, since the browser's sits flush right. */
const FilterSelect: React.FC<React.ComponentProps<"select">> = (props) => (
  <span className="relative block min-w-0">
    <select {...props} className={selectClass} />
    <ChevronDown
      size={14}
      aria-hidden="true"
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ns-ink-muted"
    />
  </span>
);

export const PlotFilters: React.FC<PlotFiltersProps> = ({
  filter,
  onChange,
  lines,
  characters,
  places,
  shown,
  total,
}) => {
  const set = (patch: PlotFilter) => onChange({ ...filter, ...patch });
  const pick = (value: string) => value || undefined;

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Filter events"
        className="flex flex-wrap items-center gap-2"
      >
        <FilterSelect
          aria-label="Plot line"
          value={filter.lineId ?? ""}
          onChange={(e) => set({ lineId: pick(e.target.value) })}
        >
          <option value="">All plot lines</option>
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.name || "Untitled plot line"}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          aria-label="Character"
          value={filter.characterId ?? ""}
          onChange={(e) => set({ characterId: pick(e.target.value) })}
        >
          <option value="">All characters</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          aria-label="Location"
          value={filter.locationId ?? ""}
          onChange={(e) => set({ locationId: pick(e.target.value) })}
        >
          <option value="">All locations</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          aria-label="Status"
          value={filter.status ?? ""}
          onChange={(e) =>
            set({ status: pick(e.target.value) as PlotEventStatus | undefined })
          }
        >
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterSelect>
      </div>
      {isFiltering(filter) && (
        <p className="font-ui text-xs text-ns-ink-secondary" aria-live="polite">
          Showing {shown} of {total} events ·{" "}
          <button
            type="button"
            onClick={() => onChange({})}
            className="font-medium text-ns-accent hover:underline"
          >
            Clear filters
          </button>
        </p>
      )}
    </div>
  );
};
