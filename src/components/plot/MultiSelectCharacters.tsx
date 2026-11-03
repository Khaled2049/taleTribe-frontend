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
      <div className="font-ui text-ns-ink-muted text-sm p-4 border border-dashed border-ns-border rounded-ns-lg text-center">
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
              className="inline-flex items-center gap-1 px-3 py-1 bg-ns-accent-subtle text-ns-accent rounded-full font-ui text-sm"
            >
              {character.name}
              <button
                type="button"
                onClick={() => removeCharacter(character.id)}
                className="hover:bg-ns-accent/20 rounded-full p-0.5 transition-colors"
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
          className="w-full p-2 rounded-ns border border-ns-border bg-ns-surface font-ui text-sm text-ns-ink focus:outline-none focus:ring-2 focus:ring-ns-accent"
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
        <p className="font-ui text-xs text-ns-ink-muted">
          Select characters that appear in this scene.
        </p>
      )}
    </div>
  );
};
