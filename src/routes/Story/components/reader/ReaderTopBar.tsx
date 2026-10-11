// src/components/reader/ReaderTopBar.tsx

import React from "react";
import { ArrowLeft, Settings, Search, Headphones } from "lucide-react";

interface ReaderTopBarProps {
  theme: {
    bg: string;
    text: string;
    border: string;
    hover: string;
  };
  onBack: () => void;
  onSearchToggle: () => void;
  onSettingsToggle: () => void;
  /** When omitted, the read-aloud button is hidden (feature flag off). */
  onReadAloudToggle?: () => void;
  readAloudActive?: boolean;
}

export const ReaderTopBar: React.FC<ReaderTopBarProps> = ({
  theme,
  onBack,
  onSearchToggle,
  onSettingsToggle,
  onReadAloudToggle,
  readAloudActive = false,
}) => {
  return (
    <div
      className={`fixed top-0 left-0 w-full z-50 pt-[env(safe-area-inset-top)] ${theme.bg} border-b ${theme.border} shadow-sm transition-colors duration-300`}
    >
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${theme.hover} transition-colors ${theme.text}`}
          aria-label="Back to story details"
        >
          <ArrowLeft size={20} />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="flex items-center gap-2">
          {onReadAloudToggle && (
            <div className="relative group">
              <button
                onClick={onReadAloudToggle}
                className={`p-2 rounded-lg ${theme.hover} transition-colors ${
                  readAloudActive ? "text-blue-500" : theme.text
                }`}
                aria-label="Read aloud (experimental)"
                aria-pressed={readAloudActive}
              >
                <Headphones size={20} />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-1.5 py-0.5 rounded bg-gray-900 text-white text-[10px] font-medium uppercase tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              >
                Experimental
              </span>
            </div>
          )}
          <button
            onClick={onSearchToggle}
            className={`p-2 rounded-lg ${theme.hover} transition-colors ${theme.text}`}
            aria-label="Search"
          >
            <Search size={20} />
          </button>
          <button
            onClick={onSettingsToggle}
            className={`p-2 rounded-lg ${theme.hover} transition-colors ${theme.text}`}
            aria-label="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
