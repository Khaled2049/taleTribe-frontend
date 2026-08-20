import { Character } from "@novelsync/story-data-client";
import { X, UserPlus } from "lucide-react";

interface MultiSelectCharactersProps {
  characters: Character[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export const MultiSelectCharacters: React.FC<MultiSelectCharactersProps> = ({
  characters,
  selectedIds,
  onChange,
}) => {
  const selectedCharacters = characters.filter((c) =>
    selectedIds.includes(c.id),
  );
  const availableCharacters = characters.filter(
    (c) => !selectedIds.includes(c.id),
  );

  const addCharacter = (id: string) => {
    onChange([...selectedIds, id]);
  };

  const removeCharacter = (id: string) => {
    onChange(selectedIds.filter((sid) => sid !== id));
  };

  if (characters.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
        <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No characters available.</p>
        <p className="text-xs mt-1">
          Create characters in the Characters section first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected Characters */}
      {selectedCharacters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCharacters.map((character) => (
            <span
              key={character.id}
              className="inline-flex items-center gap-1 px-3 py-1 bg-dark-green/20 dark:bg-light-green/20 text-dark-green dark:text-light-green rounded-full text-sm"
            >
              {character.name}
              <button
                type="button"
                onClick={() => removeCharacter(character.id)}
                className="hover:bg-dark-green/20 dark:hover:bg-light-green/20 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Available Characters Dropdown */}
      {availableCharacters.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              addCharacter(e.target.value);
            }
          }}
          className="w-full p-2 border border-black/20 dark:border-white/20 rounded bg-neutral-50 dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green transition-colors duration-200"
        >
          <option value="">Add a character...</option>
          {availableCharacters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      )}

      {selectedIds.length === 0 && availableCharacters.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Select characters that appear in this scene.
        </p>
      )}
    </div>
  );
};
