import { Place } from "@novelsync/story-data-client";
import { MapPin } from "lucide-react";

interface LocationSelectProps {
  places: Place[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

export const LocationSelect: React.FC<LocationSelectProps> = ({
  places,
  selectedId,
  onChange,
}) => {
  if (places.length === 0) {
    return (
      <div className="font-ui text-ns-ink-muted text-sm p-4 border border-dashed border-ns-border rounded-ns-lg text-center">
        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No locations available.</p>
        <p className="text-xs mt-1">
          Create places in the Places section first.
        </p>
      </div>
    );
  }

  const selectedPlace = places.find((p) => p.id === selectedId);

  return (
    <div className="space-y-3">
      <select
        value={selectedId || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full p-2 rounded-ns border border-ns-border bg-ns-surface font-ui text-sm text-ns-ink focus:outline-none focus:ring-2 focus:ring-ns-accent"
      >
        <option value="">No location selected</option>
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
          </option>
        ))}
      </select>

      {selectedPlace && selectedPlace.description && (
        <div className="p-3 bg-ns-surface rounded-ns-lg font-ui text-sm">
          <div className="flex items-center gap-2 text-ns-ink-secondary mb-1">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">{selectedPlace.name}</span>
          </div>
          <p className="text-ns-ink-muted text-xs">
            {selectedPlace.description}
          </p>
        </div>
      )}
    </div>
  );
};
