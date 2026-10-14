// src/hooks/useSearch.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChapterModel, RenderMark } from "../../../types/IReader.js";

const DEBOUNCE_MS = 200;

/**
 * In-chapter search over the chapter's plain text (so match offsets map onto
 * the rendered DOM). Input is debounced; results are emitted as RenderMarks
 * consumed by the offset-aware renderer.
 */
export const useSearch = (model: ChapterModel) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [effectiveTerm, setEffectiveTerm] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const term = effectiveTerm.trim();
    if (!term) return [] as { start: number; end: number }[];

    const haystack = model.plainText.toLowerCase();
    const needle = term.toLowerCase();
    const found: { start: number; end: number }[] = [];

    let index = haystack.indexOf(needle);
    while (index !== -1) {
      found.push({ start: index, end: index + term.length });
      index = haystack.indexOf(needle, index + 1);
    }
    return found;
  }, [model.plainText, effectiveTerm]);

  // Keep the active index within bounds whenever the result set changes.
  useEffect(() => {
    setCurrentResultIndex(0);
  }, [matches]);

  const searchMatches = useMemo<RenderMark[]>(
    () =>
      matches.map((m, i) => ({
        start: m.start,
        end: m.end,
        kind: "search",
        id: `search-${i}`,
        active: i === currentResultIndex,
      })),
    [matches, currentResultIndex],
  );

  const search = useCallback((term: string) => {
    setSearchTerm(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setEffectiveTerm(term), DEBOUNCE_MS);
  }, []);

  const clearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchTerm("");
    setEffectiveTerm("");
    setCurrentResultIndex(0);
  }, []);

  const goToNextResult = useCallback(() => {
    if (matches.length > 0) {
      setCurrentResultIndex((prev) => (prev + 1) % matches.length);
    }
  }, [matches.length]);

  const goToPreviousResult = useCallback(() => {
    if (matches.length > 0) {
      setCurrentResultIndex(
        (prev) => (prev - 1 + matches.length) % matches.length,
      );
    }
  }, [matches.length]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    searchTerm,
    searchMatches,
    currentResultIndex,
    search,
    clearSearch,
    goToNextResult,
    goToPreviousResult,
    hasResults: matches.length > 0,
    totalResults: matches.length,
  };
};
