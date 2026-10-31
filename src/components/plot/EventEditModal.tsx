import { PlotEvent, PlotLine, StoryBeatType, PacingType } from "@/types/IPlot";
import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Character } from "@novelsync/story-data-client";
import { Place } from "@novelsync/story-data-client";
import { MultiSelectCharacters } from "./MultiSelectCharacters";
import { LocationSelect } from "./LocationSelect";
import { STORY_BEAT_OPTIONS, PACING_OPTIONS } from "./plotOptions";
import { ChapterSelect } from "./ChapterSelect";
import { RequirementsEditor } from "./RequirementsEditor";
import { EventStatusControl } from "./EventStatusControl";
import type { ChapterOption } from "./plotChapters";

const labelClass =
  "block font-ui text-sm font-medium text-ns-ink-secondary mb-2";
const fieldClass =
  "w-full p-2 rounded-ns border border-ns-border bg-ns-surface font-ui text-sm text-ns-ink placeholder-ns-ink-muted focus:outline-none focus:ring-2 focus:ring-ns-accent";

interface EventEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingEvent: { plotLineId: string; event: PlotEvent } | null;
  setEditingEvent: (
    event: { plotLineId: string; event: PlotEvent } | null,
  ) => void;
  characters?: Character[];
  places?: Place[];
  chapters: ChapterOption[];
  /** Every plot line; enables the Links tab for requirements. */
  lines?: PlotLine[];
  onOpenEvent?: (eventId: string) => void;
}

const TENSION_LABELS: Record<number, string> = {
  1: "Peaceful",
  2: "Calm",
  3: "Low",
  4: "Mild",
  5: "Moderate",
  6: "Rising",
  7: "High",
  8: "Intense",
  9: "Critical",
  10: "Maximum",
};

export const EventEditModal: React.FC<EventEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingEvent,
  setEditingEvent,
  characters = [],
  places = [],
  chapters,
  lines,
  onOpenEvent,
}) => {
  const [activeTab, setActiveTab] = useState("basic");
  // Track whether a click started on the backdrop, so dragging/selecting from
  // inside the modal out onto the overlay doesn't accidentally close it.
  const pointerDownOnOverlay = useRef(false);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("basic");
    }
  }, [isOpen]);

  if (!isOpen || !editingEvent) return null;

  const event = editingEvent.event;

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    pointerDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && pointerDownOnOverlay.current) {
      onClose();
    }
    pointerDownOnOverlay.current = false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
  };

  const updateEvent = (updates: Partial<PlotEvent>) => {
    setEditingEvent({
      ...editingEvent,
      event: { ...event, ...updates, updatedAt: new Date().toISOString() },
    });
  };

  const getTensionColor = (level: number): string => {
    if (level <= 3) return "bg-green-500";
    if (level <= 5) return "bg-yellow-500";
    if (level <= 7) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center p-4"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-edit-title"
        className="bg-ns-elevated border border-ns-border p-6 rounded-ns-lg shadow-ns-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <h2
          id="event-edit-title"
          className="font-heading italic text-2xl mb-4 text-ns-ink"
        >
          Edit Event
        </h2>

        <form onSubmit={handleSubmit}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList
              className={`grid w-full mb-4 ${lines ? "grid-cols-4" : "grid-cols-3"}`}
            >
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="characters">Characters</TabsTrigger>
              <TabsTrigger value="tension">Tension</TabsTrigger>
              {lines && <TabsTrigger value="links">Links</TabsTrigger>}
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div>
                <label htmlFor="event" className={labelClass}>
                  Event Name
                </label>
                <input
                  id="event"
                  type="text"
                  value={event.name}
                  onChange={(e) => updateEvent({ name: e.target.value })}
                  className={fieldClass}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-chapter" className={labelClass}>
                    Chapter
                  </label>
                  <ChapterSelect
                    id="event-chapter"
                    chapters={chapters}
                    value={event.chapterId}
                    onChange={(chapterId) => updateEvent({ chapterId })}
                    className={`${fieldClass} w-full`}
                  />
                </div>
                <div>
                  <span className={labelClass} aria-hidden>
                    Status
                  </span>
                  <EventStatusControl
                    value={event.status}
                    onChange={(status) => updateEvent({ status })}
                    label="Status"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="content" className={labelClass}>
                  What happens
                </label>
                <textarea
                  id="content"
                  value={event.content}
                  onChange={(e) => updateEvent({ content: e.target.value })}
                  rows={6}
                  className={`${fieldClass} resize-y`}
                />
              </div>
              <div>
                <label htmlFor="notes" className={labelClass}>
                  Author Notes (private)
                </label>
                <textarea
                  id="notes"
                  value={event.notes || ""}
                  onChange={(e) => updateEvent({ notes: e.target.value })}
                  rows={3}
                  placeholder="Personal notes, reminders, ideas..."
                  className={`${fieldClass} resize-y`}
                />
              </div>
            </TabsContent>

            <TabsContent value="characters" className="space-y-4">
              <div>
                <span className={labelClass}>Characters in this scene</span>
                <MultiSelectCharacters
                  characters={characters}
                  selectedIds={event.characterIds}
                  onChange={(ids) => updateEvent({ characterIds: ids })}
                />
              </div>
              <div>
                <span className={labelClass}>Location</span>
                <LocationSelect
                  places={places}
                  selectedId={event.locationId}
                  onChange={(id) => updateEvent({ locationId: id })}
                />
              </div>
            </TabsContent>

            <TabsContent value="tension" className="space-y-6">
              <div>
                <label htmlFor="event-tension" className={labelClass}>
                  Tension Level: {event.tensionLevel} -{" "}
                  {TENSION_LABELS[event.tensionLevel]}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    id="event-tension"
                    type="range"
                    min="1"
                    max="10"
                    value={event.tensionLevel}
                    onChange={(e) =>
                      updateEvent({ tensionLevel: parseInt(e.target.value) })
                    }
                    className="flex-1 h-2 accent-ns-accent cursor-pointer"
                  />
                  <div
                    className={`w-8 h-8 rounded-full ${getTensionColor(event.tensionLevel)} flex items-center justify-center text-white font-ui font-bold text-sm`}
                  >
                    {event.tensionLevel}
                  </div>
                </div>
                <div className="flex justify-between font-ui text-xs text-ns-ink-muted mt-1">
                  <span>Peaceful</span>
                  <span>Maximum</span>
                </div>
              </div>

              <fieldset>
                <legend className={labelClass}>Pacing</legend>
                <div className="grid grid-cols-3 gap-2">
                  {PACING_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex flex-col items-center p-3 border rounded-ns-lg cursor-pointer transition-colors ${
                        event.pacing === option.value
                          ? "border-ns-accent bg-ns-accent-subtle"
                          : "border-ns-border hover:border-ns-border-strong"
                      }`}
                    >
                      <input
                        type="radio"
                        name="pacing"
                        value={option.value}
                        checked={event.pacing === option.value}
                        onChange={(e) =>
                          updateEvent({ pacing: e.target.value as PacingType })
                        }
                        className="sr-only"
                      />
                      <span className="font-ui font-medium text-sm text-ns-ink">
                        {option.label}
                      </span>
                      <span className="font-ui text-xs text-ns-ink-muted text-center mt-1">
                        {option.description}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="event-beat" className={labelClass}>
                  Story Beat
                </label>
                <select
                  id="event-beat"
                  value={event.storyBeat}
                  onChange={(e) =>
                    updateEvent({ storyBeat: e.target.value as StoryBeatType })
                  }
                  className={fieldClass}
                >
                  {STORY_BEAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="event-tone" className={labelClass}>
                  Emotional Tone
                </label>
                <input
                  id="event-tone"
                  type="text"
                  value={event.emotionalTone || ""}
                  onChange={(e) =>
                    updateEvent({ emotionalTone: e.target.value })
                  }
                  placeholder="e.g., melancholic, hopeful, tense, romantic..."
                  className={fieldClass}
                />
              </div>
            </TabsContent>

            {lines && (
              <TabsContent value="links">
                <RequirementsEditor
                  event={event}
                  lines={lines}
                  chapters={chapters}
                  onChange={(dependencies) => updateEvent({ dependencies })}
                  onOpenEvent={onOpenEvent}
                />
              </TabsContent>
            )}
          </Tabs>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-6 border-t border-ns-border mt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-ns border border-ns-border font-ui text-sm font-medium text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 rounded-ns bg-ns-accent font-ui text-sm font-medium text-white hover:bg-ns-accent-hover transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
