import React, { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { Character, Place } from "@novelsync/story-data-client";
import type { PlotEvent } from "@/types/IPlot";
import { type CardMenuItem, EventMenu } from "./EventMenu";
import { EventStatusControl } from "../EventStatusControl";
import { PACING_OPTIONS, STORY_BEAT_OPTIONS } from "../plotOptions";
import type { EventSaveState } from "../eventSaveQueue";

export type { CardMenuItem };

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
  requires?: { id: string; name: string }[];
  enables?: { id: string; name: string }[];
  /** Prerequisites placed after this event and not marked intentional. */
  late?: number;
  onOpenEvent?: (eventId: string) => void;
}

const linkList = (
  items: { id: string; name: string }[],
  onOpen?: (id: string) => void,
) =>
  items.length === 0
    ? "—"
    : items.map((item, i) => (
        <React.Fragment key={item.id}>
          {i > 0 && ", "}
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="text-ns-accent hover:underline"
            >
              {item.name || "Untitled event"}
            </button>
          ) : (
            item.name || "Untitled event"
          )}
        </React.Fragment>
      ));

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
  requires = [],
  enables = [],
  late = 0,
  onOpenEvent,
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
          <EventMenu
            eventId={event.id}
            eventName={name}
            items={menu}
            className="mt-2"
          />
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
          {(requires.length > 0 || enables.length > 0 || late > 0) && (
            <span className="inline-flex items-center gap-1 font-ui text-[11px] text-ns-ink-muted">
              {late > 0 && (
                <AlertTriangle
                  className="w-3.5 h-3.5 text-ns-destructive"
                  aria-label={
                    late === 1
                      ? "A prerequisite comes later in the manuscript"
                      : `${late} prerequisites come later in the manuscript`
                  }
                />
              )}
              {[
                requires.length > 0 && `needs ${requires.length}`,
                enables.length > 0 && `enables ${enables.length}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
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
            <dt className="text-ns-ink-muted">Requires</dt>
            <dd className="text-ns-ink-secondary">
              {linkList(requires, onOpenEvent)}
            </dd>
            <dt className="text-ns-ink-muted">Enables</dt>
            <dd className="text-ns-ink-secondary">
              {linkList(enables, onOpenEvent)}
            </dd>
          </dl>
        )}
      </div>
    </article>
  );
};
