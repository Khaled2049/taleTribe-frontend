import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Character, Place } from "@novelsync/story-data-client";
import type { PlotEvent } from "@/types/IPlot";
import { type CardMenuItem, EventMenu } from "./EventMenu";
import { EventStatusControl } from "../EventStatusControl";
import { PACING_OPTIONS, STORY_BEAT_OPTIONS } from "../plotOptions";
import type { EventSaveState } from "../eventSaveQueue";
import { NO_AUTOFILL } from "@/lib/noAutofill";
import type { ChapterOption } from "../plotChapters";
import { ChapterPicker } from "./ChapterPicker";
import { OptionPicker } from "./OptionPicker";

export type { CardMenuItem };

interface EventCardProps {
  event: PlotEvent;
  /** The event's plot line, when the outline is grouped by chapter. */
  tag?: string;
  chapters: ChapterOption[];
  onAssignChapter: (chapterId: string | null) => void;
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
  chapters,
  onAssignChapter,
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
            {tag && (
              <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-ns-ink-muted truncate">
                {tag}
              </p>
            )}
            <input
              {...NO_AUTOFILL}
              value={event.name}
              onChange={(e) => onChange({ ...event, name: e.target.value })}
              aria-label="Event name"
              placeholder="Untitled event"
              className={`${inlineField} font-ui text-sm font-medium text-ns-ink`}
            />
          </div>
          <EventMenu
            eventId={event.id}
            eventName={name}
            items={menu}
            className="mt-2"
          />
        </div>

        <textarea
          {...NO_AUTOFILL}
          value={event.content}
          onChange={(e) => onChange({ ...event, content: e.target.value })}
          aria-label="What happens"
          placeholder="What happens…"
          rows={2}
          className={`${inlineField} block resize-none font-body text-sm leading-snug text-ns-ink-secondary [field-sizing:content] ${
            open ? "" : "max-h-[2.6rem] overflow-hidden focus:max-h-none"
          }`}
        />

        <div className="flex flex-wrap items-center gap-2">
          <ChapterPicker
            chapters={chapters}
            value={event.chapterId}
            eventName={name}
            onChange={onAssignChapter}
          />
          <OptionPicker
            label="Pacing"
            eventName={name}
            options={PACING_OPTIONS}
            value={event.pacing}
            onChange={(pacing) => onChange({ ...event, pacing })}
          />
          <OptionPicker
            label="Beat"
            eventName={name}
            options={STORY_BEAT_OPTIONS}
            value={event.storyBeat}
            onChange={(storyBeat) => onChange({ ...event, storyBeat })}
          />
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
            className="ml-auto inline-flex items-center gap-1 font-ui text-[11px] text-ns-ink-secondary hover:text-ns-ink"
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
          </dl>
        )}
      </div>
    </article>
  );
};
