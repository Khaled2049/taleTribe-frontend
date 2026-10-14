// src/components/reader/WordDefinitionPopup.tsx

import React from "react";
import { usePopoverPosition } from "../../../../hooks/usePopoverPosition.js";
import { X, Loader } from "lucide-react";
import { WordDefinition } from "../../../../types/IReader.js";

interface WordDefinitionPopupProps {
  word: string;
  definition: WordDefinition | null;
  loading: boolean;
  error: string | null;
  position: { x: number; y: number };
  onClose: () => void;
}

export const WordDefinitionPopup: React.FC<WordDefinitionPopupProps> = ({
  word,
  definition,
  loading,
  error,
  position,
  onClose,
}) => {
  const { ref, style } = usePopoverPosition(position);
  return (
    <div
      ref={ref}
      className="fixed z-50 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4"
      style={style}
    >
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader size={24} className="animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="text-center py-2">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={onClose}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Close
          </button>
        </div>
      ) : definition ? (
        <>
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-bold text-lg capitalize">{word}</h4>
              <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                {definition.partOfSpeech}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="Close definition"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            {definition.definition}
          </p>

          {definition.examples && definition.examples.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Example:
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                "{definition.examples[0]}"
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
