import {
  PlotEvent,
  StoryBeatType,
  PacingType,
  ensureEventDefaults,
} from "@/types/IPlot";
import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Character } from "@novelsync/story-data-client";
import { Place } from "@novelsync/story-data-client";
import { MultiSelectCharacters } from "./MultiSelectCharacters";
import { LocationSelect } from "./LocationSelect";
import { STORY_BEAT_OPTIONS, PACING_OPTIONS } from "./plotOptions";

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

  // Ensure event has all fields with defaults
  const event = ensureEventDefaults(
    editingEvent.event,
    editingEvent.event.orderIndex ?? 0,
  );

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
      className="fixed inset-0 z-50 bg-black/50 dark:bg-black/50 flex justify-center items-center p-4"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div className="bg-neutral-50 dark:bg-gray-900 p-6 rounded-lg shadow-xl w-full max-w-2xl transition-colors duration-200 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Edit Event
        </h2>

        <form onSubmit={handleSubmit}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="characters">Characters</TabsTrigger>
              <TabsTrigger value="tension">Tension</TabsTrigger>
            </TabsList>

            {/* Tab 1: Basic Info */}
            <TabsContent value="basic" className="space-y-4">
              <div>
                <label
                  htmlFor="event"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Event Name
                </label>
                <input
                  id="event"
                  type="text"
                  value={event.name}
                  onChange={(e) => updateEvent({ name: e.target.value })}
                  className="w-full p-2 border border-black/20 dark:border-white/20 rounded bg-neutral-50 dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green transition-colors duration-200"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="content"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Content
                </label>
                <textarea
                  id="content"
                  value={event.content}
                  onChange={(e) => updateEvent({ content: e.target.value })}
                  rows={6}
                  className="w-full p-2 border border-black/20 dark:border-white/20 rounded bg-neutral-50 dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green transition-colors duration-200 resize-y"
                />
              </div>
              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Author Notes (private)
                </label>
                <textarea
                  id="notes"
                  value={event.notes || ""}
                  onChange={(e) => updateEvent({ notes: e.target.value })}
                  rows={3}
                  placeholder="Personal notes, reminders, ideas..."
                  className="w-full p-2 border border-black/20 dark:border-white/20 rounded bg-neutral-50 dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green transition-colors duration-200 resize-y"
                />
              </div>
            </TabsContent>

            {/* Tab 2: Characters & Location */}
            <TabsContent value="characters" className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Characters in this scene
                </label>
                <MultiSelectCharacters
                  characters={characters}
                  selectedIds={event.characterIds}
                  onChange={(ids) => updateEvent({ characterIds: ids })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Location
                </label>
                <LocationSelect
                  places={places}
                  selectedId={event.locationId}
                  onChange={(id) => updateEvent({ locationId: id })}
                />
              </div>
            </TabsContent>

            {/* Tab 3: Tension & Pacing */}
            <TabsContent value="tension" className="space-y-6">
              {/* Tension Slider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tension Level: {event.tensionLevel} -{" "}
                  {TENSION_LABELS[event.tensionLevel]}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={event.tensionLevel}
                    onChange={(e) =>
                      updateEvent({ tensionLevel: parseInt(e.target.value) })
                    }
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div
                    className={`w-8 h-8 rounded-full ${getTensionColor(event.tensionLevel)} flex items-center justify-center text-white font-bold text-sm`}
                  >
                    {event.tensionLevel}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>Peaceful</span>
                  <span>Maximum</span>
                </div>
              </div>

              {/* Pacing Radio Buttons */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pacing
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PACING_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-all ${
                        event.pacing === option.value
                          ? "border-dark-green dark:border-light-green bg-dark-green/10 dark:bg-light-green/10"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
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
                      <span className="font-medium text-gray-900 dark:text-white">
                        {option.label}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                        {option.description}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Story Beat Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Story Beat
                </label>
                <select
                  value={event.storyBeat}
                  onChange={(e) =>
                    updateEvent({ storyBeat: e.target.value as StoryBeatType })
                  }
                  className="w-full p-2 border border-black/20 dark:border-white/20 rounded bg-neutral-50 dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green transition-colors duration-200"
                >
                  {STORY_BEAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Emotional Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Emotional Tone
                </label>
                <input
                  type="text"
                  value={event.emotionalTone || ""}
                  onChange={(e) =>
                    updateEvent({ emotionalTone: e.target.value })
                  }
                  placeholder="e.g., melancholic, hopeful, tense, romantic..."
                  className="w-full p-2 border border-black/20 dark:border-white/20 rounded bg-neutral-50 dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green transition-colors duration-200"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-6 border-t border-gray-200 dark:border-gray-700 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto bg-black/10 dark:bg-neutral-50/10 text-black dark:text-white px-4 py-2 rounded hover:bg-black/20 dark:hover:bg-neutral-50/20 transition-colors duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto bg-dark-green dark:bg-light-green text-white px-4 py-2 rounded hover:bg-light-green dark:hover:bg-dark-green transition-colors duration-200 font-medium"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
