import { useEffect, useState } from "react";

/**
 * Trailing-edge debounce for a value. Search inputs use this so a query fires
 * once the typing stops rather than once per keystroke — every call is a
 * billable Firestore read.
 */
export const useDebouncedValue = <T>(value: T, delayMs = 250): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
