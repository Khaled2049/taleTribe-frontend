// src/hooks/useWordLookup.ts

import { useState, useCallback, useRef } from "react";
import { WordDefinition, MenuPosition } from "../../../types/IReader.js";
import { useReaderEnvironment } from "../../../runtime.js";
import { cleanWord } from "./useChapterModel.js";

export const useWordLookup = () => {
  const { lookupWord: lookup } = useReaderEnvironment();
  const [definition, setDefinition] = useState<WordDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  // Guards against rapid clicks: only the latest lookup is allowed to render.
  const requestIdRef = useRef(0);

  const lookupWord = useCallback(
    async (word: string, x: number, y: number) => {
      // Unicode-aware clean (keeps accented letters), then lowercase for the API.
      const term = cleanWord(word).toLowerCase();
      if (!term) return;

      const reqId = ++requestIdRef.current;
      setSelectedWord(term);
      setPosition({ x, y });
      setDefinition(null);
      setLoading(true);
      setError(null);

      try {
        const result = await lookup(term);
        if (reqId !== requestIdRef.current) return;
        setDefinition(result);
      } catch (err) {
        if (reqId !== requestIdRef.current) return;
        setError("No definition found");
        console.error("Dictionary lookup error:", err);
      } finally {
        if (reqId === requestIdRef.current) setLoading(false);
      }
    },
    [lookup],
  );

  const clearDefinition = useCallback(() => {
    // Invalidate any in-flight lookup so it can't reopen the popup.
    requestIdRef.current++;
    setDefinition(null);
    setSelectedWord(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    definition,
    loading,
    error,
    position,
    selectedWord,
    lookupWord,
    clearDefinition,
  };
};
