import React, { useState } from "react";
import { MapPin, Users } from "lucide-react";
import type { Character, Place } from "@novelsync/story-data-client";
import type { PlotEvent } from "@/types/IPlot";

const LONG_DESCRIPTION = 160;

interface EventSummaryProps {
  event: PlotEvent;
  /** A label shown above the name, e.g. the event's plot line. */
  context?: string;
  characters: Character[];
  places: Place[];
}

/** How an event reads at a glance; shared by every compact view of the plan. */
export const EventSummary: React.FC<EventSummaryProps> = ({
  event,
  context,
  characters,
  places,
}) => {
  const [expanded, setExpanded] = useState(false);
  const cast = characters.filter((c) => event.characterIds.includes(c.id));
  const place = places.find((p) => p.id === event.locationId);
  const long = event.content.length > LONG_DESCRIPTION;

  return (
    <div className="min-w-0 space-y-1.5">
      {context && (
        <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-ns-ink-muted truncate">
          {context}
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-ui text-sm font-medium text-ns-ink leading-snug break-words">
          {event.name || "Untitled event"}
        </h4>
        <span
          className="flex-shrink-0 font-ui text-[11px] tabular-nums text-ns-ink-muted"
          title={`Tension ${event.tensionLevel} of 10`}
        >
          Tension {event.tensionLevel}
        </span>
      </div>
      {event.content && (
        <div>
          <p
            className={`font-body text-sm text-ns-ink-secondary leading-snug whitespace-pre-line ${
              expanded ? "" : "line-clamp-3"
            }`}
          >
            {event.content}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="font-ui text-[11px] text-ns-accent hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
      {(cast.length > 0 || place) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-ui text-[11px] text-ns-ink-muted">
          {cast.length > 0 && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <Users className="w-3 h-3 flex-shrink-0" aria-hidden />
              <span className="sr-only">Characters:</span>
              <span className="truncate">
                {cast.map((c) => c.name).join(", ")}
              </span>
            </span>
          )}
          {place && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden />
              <span className="sr-only">Location:</span>
              <span className="truncate">{place.name}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
