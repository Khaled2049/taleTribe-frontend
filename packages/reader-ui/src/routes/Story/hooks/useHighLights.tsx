// src/hooks/useHighlights.ts

import { useState, useEffect, useCallback } from "react";
import { Highlight } from "../../../types/IReader.js";
import { useReaderEnvironment } from "../../../runtime.js";

export const useHighlights = (chapterId: string) => {
  const { highlights: highlightService } = useReaderEnvironment();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load highlights for the current chapter
  useEffect(() => {
    const loadHighlights = async () => {
      setLoading(true);
      setError(null);

      try {
        const saved = await highlightService.getByChapter(chapterId);
        setHighlights(saved);
      } catch (err) {
        setError("Failed to load highlights");
        console.error("Error loading highlights:", err);
      } finally {
        setLoading(false);
      }
    };

    loadHighlights();
  }, [chapterId, highlightService]);

  const addHighlight = useCallback(
    async (
      text: string,
      color: Highlight["color"],
      position: { start: number; end: number },
      note?: string,
    ) => {
      const newHighlight: Highlight = {
        id: Date.now().toString(),
        chapterId,
        text,
        color,
        note,
        position,
        createdAt: new Date(),
      };

      try {
        await highlightService.save(newHighlight);
        setHighlights((prev) => [...prev, newHighlight]);
        return newHighlight;
      } catch (err) {
        console.error("Error saving highlight:", err);
        throw err;
      }
    },
    [chapterId, highlightService],
  );

  const deleteHighlight = useCallback(
    async (id: string) => {
      try {
        await highlightService.delete(id);
        setHighlights((prev) => prev.filter((h) => h.id !== id));
      } catch (err) {
        console.error("Error deleting highlight:", err);
        throw err;
      }
    },
    [highlightService],
  );

  const updateHighlight = useCallback(
    async (id: string, updates: Partial<Highlight>) => {
      try {
        await highlightService.update(id, updates);
        setHighlights((prev) =>
          prev.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        );
      } catch (err) {
        console.error("Error updating highlight:", err);
        throw err;
      }
    },
    [highlightService],
  );

  const getHighlightsByColor = useCallback(
    (color: Highlight["color"]) => {
      return highlights.filter((h) => h.color === color);
    },
    [highlights],
  );

  return {
    highlights,
    loading,
    error,
    addHighlight,
    deleteHighlight,
    updateHighlight,
    getHighlightsByColor,
  };
};
