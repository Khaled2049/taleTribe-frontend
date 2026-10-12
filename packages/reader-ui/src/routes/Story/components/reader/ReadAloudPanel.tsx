// src/components/reader/ReadAloudPanel.tsx

import React, { useEffect, useRef } from "react";
import { X, Headphones, Play, Pause, Square, Gauge, Mic2 } from "lucide-react";
import { TtsVoiceId } from "../../../../types/IReader.js";
import type { ReadAloudStatus } from "../../../../read-aloud.js";

interface ReadAloudPanelProps {
  status: ReadAloudStatus;
  /** English voices offered by the browser; empty until `voiceschanged` fires. */
  voices: SpeechSynthesisVoice[];
  voice: TtsVoiceId;
  speed: number;
  onVoiceChange: (voice: TtsVoiceId) => void;
  onSpeedChange: (speed: number) => void;
  onPlayPause: () => void;
  onStop: () => void;
  onClose: () => void;
}

export const ReadAloudPanel: React.FC<ReadAloudPanelProps> = ({
  status,
  voices,
  voice,
  speed,
  onVoiceChange,
  onSpeedChange,
  onPlayPause,
  onStop,
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

  // The stored voiceURI may not exist on this device; the hook falls back to the
  // browser default, so reflect that here rather than showing a blank select.
  const selectedVoice =
    voices.find((v) => v.voiceURI === voice) ??
    voices.find((v) => v.default) ??
    voices[0];

  return (
    <div
      ref={panelRef}
      className="fixed top-16 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Headphones size={20} className="text-gray-900 dark:text-gray-100" />
          Read Aloud
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-900 dark:text-gray-100"
          aria-label="Close read aloud"
        >
          <X size={20} />
        </button>
      </div>

      {/* Transport */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={onPlayPause}
          disabled={voices.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-medium transition-colors"
          aria-label={status === "playing" ? "Pause" : "Play"}
        >
          {status === "playing" ? <Pause size={18} /> : <Play size={18} />}
          {status === "playing"
            ? "Pause"
            : status === "paused"
              ? "Resume"
              : "Play"}
        </button>
        <button
          onClick={onStop}
          disabled={status === "idle"}
          className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
          aria-label="Stop"
        >
          <Square size={18} />
        </button>
      </div>

      {voices.length === 0 && (
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          No speech voices are available in this browser.
        </p>
      )}

      {status === "error" && (
        <p className="mb-6 text-sm text-red-600 dark:text-red-400">
          Something went wrong. Press play to try again.
        </p>
      )}

      {/* Voice */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          <Mic2 size={16} className="text-gray-900 dark:text-gray-100" />
          Voice
        </label>
        <select
          value={selectedVoice?.voiceURI ?? ""}
          onChange={(e) => onVoiceChange(e.target.value)}
          disabled={voices.length === 0}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          aria-label="Voice"
        >
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Voices are provided by your browser and operating system.
        </p>
      </div>

      {/* Speed */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          <Gauge size={16} className="text-gray-900 dark:text-gray-100" />
          Speed: {speed.toFixed(1)}×
        </label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
          <span>0.5×</span>
          <span>2.0×</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Changes apply from the current sentence.
        </p>
      </div>
    </div>
  );
};
