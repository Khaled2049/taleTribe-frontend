// src/components/reader/ReaderSettingsPanel.tsx

import React, { useEffect, useRef } from "react";
import { X, Settings, Type, BookOpen, Palette } from "lucide-react";
import { ReaderSettings } from "@/types/IReader";

interface ReaderSettingsPanelProps {
  settings: ReaderSettings;
  onUpdateSettings: (settings: Partial<ReaderSettings>) => void;
  onClose: () => void;
}

export const ReaderSettingsPanel: React.FC<ReaderSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="fixed top-16 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Settings size={20} className="text-gray-900 dark:text-gray-100" />
          Reader Settings
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-900 dark:text-gray-100"
          aria-label="Close settings"
        >
          <X size={20} />
        </button>
      </div>

      {/* Font Size */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          <Type size={16} className="text-gray-900 dark:text-gray-100" />
          Font Size: {settings.fontSize}px
        </label>
        <input
          type="range"
          min="14"
          max="28"
          value={settings.fontSize}
          onChange={(e) =>
            onUpdateSettings({ fontSize: Number(e.target.value) })
          }
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>14px</span>
          <span>28px</span>
        </div>
      </div>

      {/* Font Family */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          <BookOpen size={16} className="text-gray-900 dark:text-gray-100" />
          Font Family
        </label>
        <select
          value={settings.fontFamily}
          onChange={(e) =>
            onUpdateSettings({
              fontFamily: e.target.value as ReaderSettings["fontFamily"],
            })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="serif">Serif</option>
          <option value="sans">Sans Serif</option>
          <option value="mono">Monospace</option>
          <option value="palatino">Palatino</option>
          <option value="bookerly">Bookerly</option>
        </select>
      </div>

      {/* Line Height */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          Line Spacing: {settings.lineHeight.toFixed(1)}
        </label>
        <input
          type="range"
          min="1.4"
          max="2.4"
          step="0.2"
          value={settings.lineHeight}
          onChange={(e) =>
            onUpdateSettings({ lineHeight: Number(e.target.value) })
          }
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>1.4</span>
          <span>2.4</span>
        </div>
      </div>

      {/* Theme */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">
          <Palette size={16} className="text-gray-900 dark:text-gray-100" />
          Theme
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onUpdateSettings({ theme: "light" })}
            className={`p-3 rounded-lg border-2 transition-all ${
              settings.theme === "light"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            }`}
            aria-label="Light theme"
          >
            <div className="w-full h-8 bg-white border border-gray-300 rounded mb-1"></div>
            <span className="text-xs text-gray-900 dark:text-gray-100">
              Light
            </span>
          </button>
          <button
            onClick={() => onUpdateSettings({ theme: "dark" })}
            className={`p-3 rounded-lg border-2 transition-all ${
              settings.theme === "dark"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            }`}
            aria-label="Dark theme"
          >
            <div className="w-full h-8 bg-gray-900 border border-gray-700 rounded mb-1"></div>
            <span className="text-xs text-gray-900 dark:text-gray-100">
              Dark
            </span>
          </button>
          <button
            onClick={() => onUpdateSettings({ theme: "sepia" })}
            className={`p-3 rounded-lg border-2 transition-all ${
              settings.theme === "sepia"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            }`}
            aria-label="Sepia theme"
          >
            <div className="w-full h-8 bg-[#f4ecd8] border border-[#d4c4a8] rounded mb-1"></div>
            <span className="text-xs text-gray-900 dark:text-gray-100">
              Sepia
            </span>
          </button>
        </div>
      </div>

      {/* Text Align */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          Text Alignment
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onUpdateSettings({ textAlign: "left" })}
            className={`px-4 py-2 rounded-lg border transition-all text-gray-900 dark:text-gray-100 ${
              settings.textAlign === "left"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                : "border-gray-300 dark:border-gray-600"
            }`}
          >
            Left
          </button>
          <button
            onClick={() => onUpdateSettings({ textAlign: "justify" })}
            className={`px-4 py-2 rounded-lg border transition-all text-gray-900 dark:text-gray-100 ${
              settings.textAlign === "justify"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                : "border-gray-300 dark:border-gray-600"
            }`}
          >
            Justify
          </button>
        </div>
      </div>
    </div>
  );
};
