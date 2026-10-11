// src/components/reader/ReaderSearchPanel.tsx

import React, { useEffect, useRef } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";

interface ReaderSearchPanelProps {
  searchTerm: string;
  totalResults: number;
  currentResultIndex: number;
  onSearchChange: (term: string) => void;
  onClose: () => void;
  onNextResult: () => void;
  onPrevResult: () => void;
}

export const ReaderSearchPanel: React.FC<ReaderSearchPanelProps> = ({
  searchTerm,
  totalResults,
  currentResultIndex,
  onSearchChange,
  onClose,
  onNextResult,
  onPrevResult,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus input when panel opens
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed top-[calc(4rem_+_env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-2">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search in chapter..."
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Close search"
        >
          <X size={20} />
        </button>
      </div>

      {totalResults > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {currentResultIndex + 1} of {totalResults} results
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={onPrevResult}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="Previous result"
              disabled={totalResults === 0}
            >
              <ChevronUp size={18} />
            </button>
            <button
              onClick={onNextResult}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="Next result"
              disabled={totalResults === 0}
            >
              <ChevronDown size={18} />
            </button>
          </div>
        </div>
      )}

      {searchTerm && totalResults === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No results found
        </p>
      )}
    </div>
  );
};
