import React, { useState } from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import type { Character, Place } from "@novelsync/story-data-client";
import type { PlotEvent } from "@/types/IPlot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EventStatusControl } from "../EventStatusControl";
import { PACING_OPTIONS, STORY_BEAT_OPTIONS } from "../plotOptions";
import type { EventSaveState } from "../eventSaveQueue";

export interface CardMenuItem {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  /** Draws a separator above this item. */
  separated?: boolean;
}

interface EventCardProps {
  event: PlotEvent;
  /** Where the event sits in the other grouping: its plot line, or its chapter. */
  tag: string;
  characters: Character[];
  places: Place[];
  saveState?: EventSaveState;
  highlighted?: boolean;
  onChange: (event: PlotEvent) => void;
  menu: CardMenuItem[];
  /** Rendered before the body, e.g. a drag handle. */
  handle?: React.ReactNode;
}

const inlineField =
  "w-full bg-transparent rounded-ns px-1 -mx-1 focus:outline-none focus:bg-ns-surface focus:ring-1 focus:ring-ns-accent";

export const EventCard: React.FC<EventCardProps> = ({
  event,
  tag,
  characters,
  places,
  saveState,
  highlighted,
  onChange,
  menu,
  handle,
}) => {
  const [open, setOpen] = useState(false);
  const failed = saveState === "error" || saveState === "conflict";
  const cast = characters.filter((c) => event.characterIds.includes(c.id));
  const place = places.find((p) => p.id === event.locationId);
  const name = event.name || "Untitled event";

  return (
    <article
      id={`plot-event-${event.id}`}
      aria-label={name}
      className={`flex gap-2 rounded-ns-lg border bg-ns-elevated p-3 transition-colors ${
        failed
          ? "border-ns-destructive"
          : highlighted
            ? "border-ns-accent bg-ns-accent-subtle"
            : "border-ns-border"
      }`}
    >
      {handle}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-ns-ink-muted truncate">
              {tag}
            </p>
            <input
              value={event.name}
              onChange={(e) => onChange({ ...event, name: e.target.value })}
              aria-label="Event name"
              placeholder="Untitled event"
              className={`${inlineField} font-ui text-sm font-medium text-ns-ink`}
            />
          </div>
          <span
            className="flex-shrink-0 pt-3 font-ui text-[11px] tabular-nums text-ns-ink-muted"
            title={`Tension ${event.tensionLevel} of 10`}
          >
            Tension {event.tensionLevel}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${name}`}
              className="flex-shrink-0 mt-2 p-1.5 rounded-ns text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover"
            >
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border border-ns-border bg-ns-elevated shadow-ns-lg rounded-ns-lg p-1 min-w-[200px]"
            >
              {menu.map((item) => (
                <React.Fragment key={item.label}>
                  {item.separated && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onSelect={item.onSelect}
                    className={`px-3 py-2 rounded-ns cursor-pointer font-ui text-sm ${
                      item.destructive ? "text-ns-destructive" : "text-ns-ink"
                    }`}
                  >
                    {item.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <textarea
          value={event.content}
          onChange={(e) => onChange({ ...event, content: e.target.value })}
          aria-label="What happens"
          placeholder="What happens…"
          rows={2}
          className={`${inlineField} block resize-none font-body text-sm leading-snug text-ns-ink-secondary [field-sizing:content] ${
            open ? "" : "max-h-[2.6rem] overflow-hidden focus:max-h-none"
          }`}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <EventStatusControl
            size="sm"
            value={event.status}
            label={`Status of ${name}`}
            onChange={(status) => onChange({ ...event, status })}
          />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 font-ui text-[11px] text-ns-ink-secondary hover:text-ns-ink"
          >
            {open ? "Less" : "Details"}
            <ChevronDown
              className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </div>

        {open && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1 border-t border-ns-border font-ui text-xs">
            <dt className="text-ns-ink-muted">Characters</dt>
            <dd className="text-ns-ink-secondary">
              {cast.length ? cast.map((c) => c.name).join(", ") : "—"}
            </dd>
            <dt className="text-ns-ink-muted">Location</dt>
            <dd className="text-ns-ink-secondary">{place?.name ?? "—"}</dd>
            <dt className="text-ns-ink-muted">Pacing</dt>
            <dd className="text-ns-ink-secondary">
              {PACING_OPTIONS.find((o) => o.value === event.pacing)?.label ??
                event.pacing}
            </dd>
            <dt className="text-ns-ink-muted">Beat</dt>
            <dd className="text-ns-ink-secondary">
              {STORY_BEAT_OPTIONS.find((o) => o.value === event.storyBeat)
                ?.label ?? event.storyBeat}
            </dd>
            <dt className="text-ns-ink-muted">Time</dt>
            <dd className="text-ns-ink-secondary">
              {event.timeConstraint?.timeGap || "—"}
            </dd>
          </dl>
        )}
      </div>
    </article>
  );
};
