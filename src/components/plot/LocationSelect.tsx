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
      <div className="text-gray-500 dark:text-gray-400 text-sm p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
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
        className="w-full p-2 border border-black/20 dark:border-white/20 rounded bg-neutral-50 dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green transition-colors duration-200"
      >
        <option value="">No location selected</option>
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
          </option>
        ))}
      </select>

      {selectedPlace && selectedPlace.description && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-1">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">{selectedPlace.name}</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-xs">
            {selectedPlace.description}
          </p>
        </div>
      )}
    </div>
  );
};
