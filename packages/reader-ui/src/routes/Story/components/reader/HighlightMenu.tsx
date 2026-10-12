// src/components/reader/HighlightMenu.tsx

import React from "react";
import { Highlight } from "../../../../types/IReader.js";
import { HIGHLIGHT_COLORS } from "../../constants/readerThemes.js";

interface HighlightMenuProps {
  position: { x: number; y: number };
  onSelectColor: (color: Highlight["color"]) => void;
}

export const HighlightMenu: React.FC<HighlightMenuProps> = ({
  position,
  onSelectColor,
}) => {
  const colors: Array<{ color: Highlight["color"]; label: string }> = [
    { color: "yellow", label: "Yellow" },
    { color: "green", label: "Green" },
    { color: "blue", label: "Blue" },
    { color: "pink", label: "Pink" },
  ];

  return (
    <div
      data-highlight-menu
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-2 flex gap-2"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -100%)",
      }}
    >
      {colors.map(({ color, label }) => (
        <button
          key={color}
          onClick={() => onSelectColor(color)}
          className={`w-8 h-8 rounded transition-colors ${HIGHLIGHT_COLORS[color]}`}
          title={`${label} highlight`}
          aria-label={`Highlight in ${label.toLowerCase()}`}
        />
      ))}
    </div>
  );
};
