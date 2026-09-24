import React, { useState } from "react";
import { Editor } from "@tiptap/react";

interface SuggestionMenuProps {
  suggestions: string[];
  editor: Editor;
  onClose: () => void;
}

export const SuggestionMenu: React.FC<SuggestionMenuProps> = ({
  suggestions,
  editor,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const insertSuggestion = React.useCallback(
    (suggestion: string) => {
      editor.chain().focus().insertContent(suggestion).run();
      onClose();
    },
    [editor, onClose],
  );

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertSuggestion(suggestions[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, suggestions, insertSuggestion, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Choose a suggestion
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => insertSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                index === selectedIndex
                  ? "bg-dark-green text-white"
                  : "bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium mt-0.5">{index + 1}.</span>
                <span className="flex-1">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          Use ↑↓ to navigate, Enter to select, Esc to cancel
        </div>
      </div>
    </div>
  );
};
