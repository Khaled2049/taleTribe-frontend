export interface SpoilerRange {
  start: number;
  end?: number;
}

/**
 * Firestore rejects an explicit `undefined` anywhere in a document, so an absent
 * value has to leave its key out rather than set it to undefined. That applies
 * twice here: to the range itself on a message with no spoiler, and to `end`
 * inside a range that is open-ended.
 *
 * Returns a fragment to spread, not a value to assign — assigning is what
 * reintroduces the key.
 */
export function spoilerRangeField(
  range: SpoilerRange | undefined,
): { spoilerChapterRange?: SpoilerRange } {
  if (!range) return {};
  return {
    spoilerChapterRange: {
      start: range.start,
      ...(range.end !== undefined ? { end: range.end } : {}),
    },
  };
}
