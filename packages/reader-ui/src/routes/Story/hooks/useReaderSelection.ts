import { useCallback, useEffect, useRef, useState } from "react";

export interface ReaderSelection {
  text: string;
  start: number;
  end: number;
  rect: DOMRect;
}

const isWhitespace = (ch: string | undefined) => !!ch && /\s/.test(ch);

/**
 * Tracks text selection within a content container and converts it into global
 * character offsets against the chapter's `plainText`. Offsets are exact under
 * the model's Option-A construction (no inter-block separators), so a Range
 * measured by `toString().length` over the container matches `plainText`.
 */
export function useReaderSelection(
  containerRef: React.RefObject<HTMLElement | null>,
  plainText: string,
) {
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  // Avoid re-subscribing listeners when plainText changes between chapters.
  const plainTextRef = useRef(plainText);
  plainTextRef.current = plainText;

  const clear = useCallback(() => setSelection(null), []);

  useEffect(() => {
    const handle = () => {
      const sel = window.getSelection();
      const container = containerRef.current;
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !container) {
        setSelection(null);
        return;
      }

      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }

      // Measure offset from container start to the selection boundary.
      const pre = document.createRange();
      pre.selectNodeContents(container);
      pre.setEnd(range.startContainer, range.startOffset);
      let start = pre.toString().length;
      let end = start + range.toString().length;

      const text = plainTextRef.current;
      while (start < end && isWhitespace(text[start])) start++;
      while (end > start && isWhitespace(text[end - 1])) end--;
      if (end <= start) {
        setSelection(null);
        return;
      }

      setSelection({
        text: text.slice(start, end),
        start,
        end,
        rect: range.getBoundingClientRect(),
      });
    };

    const deferred = () => window.setTimeout(handle, 10);
    document.addEventListener("mouseup", deferred);
    document.addEventListener("touchend", deferred);
    return () => {
      document.removeEventListener("mouseup", deferred);
      document.removeEventListener("touchend", deferred);
    };
  }, [containerRef]);

  return { selection, clear };
}
