import { useCallback, useState } from "react";

/** useState backed by localStorage. Storage can throw (private mode, blocked site data), so it degrades to memory. */
export function useStoredState<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string = String,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return parse(localStorage.getItem(key));
    } catch {
      return parse(null);
    }
  });

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, serialize(next));
      } catch {
        // Keep the in-memory value.
      }
    },
    [key, serialize],
  );

  return [value, set];
}
