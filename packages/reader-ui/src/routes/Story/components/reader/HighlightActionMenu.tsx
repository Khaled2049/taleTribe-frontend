// src/components/reader/HighlightActionMenu.tsx

import React, { useEffect, useState } from "react";
import { usePopoverPosition } from "../../../../hooks/usePopoverPosition.js";
import { Trash2, StickyNote } from "lucide-react";
import { Highlight } from "../../../../types/IReader.js";

interface HighlightActionMenuProps {
  position: { x: number; y: number };
  highlight: Highlight;
  onDelete: () => void;
  onSaveNote: (note: string) => void;
  onClose: () => void;
}

export const HighlightActionMenu: React.FC<HighlightActionMenuProps> = ({
  position,
  highlight,
  onDelete,
  onSaveNote,
  onClose,
}) => {
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(highlight.note ?? "");
  const { ref, style } = usePopoverPosition(position);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose, ref]);

  return (
    <div
      ref={ref}
      data-highlight-menu
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-2 w-56"
      style={style}
    >
      {editingNote ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
            rows={3}
            className="w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ns-accent"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditingNote(false)}
              className="text-xs px-2 py-1 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSaveNote(note.trim());
                setEditingNote(false);
              }}
              className="text-xs px-3 py-1 rounded bg-ns-accent text-white hover:bg-ns-accent-hover"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {highlight.note && (
            <p className="text-xs text-gray-600 dark:text-gray-300 px-2 py-1.5 italic border-b border-gray-100 dark:border-gray-700 mb-1">
              {highlight.note}
            </p>
          )}
          <button
            onClick={() => setEditingNote(true)}
            className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-black dark:text-white"
          >
            <StickyNote size={15} />
            {highlight.note ? "Edit note" : "Add note"}
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
          >
            <Trash2 size={15} />
            Remove highlight
          </button>
        </div>
      )}
    </div>
  );
};
