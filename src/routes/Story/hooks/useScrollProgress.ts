import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { findScrollParent } from "@/lib/scrollParent";

const PERSIST_THROTTLE_MS = 10000;
const RESTORE_SUPPRESS_MS = 500;
const RESTORE_REAPPLY_MS = 300;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function scrollFraction(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const max = scrollHeight - clientHeight;
  return max > 0 ? clamp01(scrollTop / max) : 0;
}

interface Scroller {
  target: EventTarget;
  element: Element;
}

function resolveScroller(node: Element | null): Scroller {
  const parent = node ? findScrollParent(node) : null;
  if (parent) return { target: parent, element: parent };
  return {
    target: window,
    element: document.scrollingElement ?? document.documentElement,
  };
}

const currentFraction = (el: Element) =>
  scrollFraction(el.scrollTop, el.scrollHeight, el.clientHeight);

interface UseScrollProgressOptions {
  contentRef: React.RefObject<Element | null>;
  /** Stable id of the chapter currently shown. */
  chapterId: string;
  /** True once the chapter content is actually in the DOM. */
  contentReady: boolean;
  /** Scroll fraction to restore on entering this chapter, or null for top. */
  savedPercentForChapter: number | null;
  /** Throttled persistence callback (latest scroll fraction). */
  onPersist: (percent: number) => void;
}

/**
 * Tracks the reader's scroll container as a 0–1 fraction (robust to font-size
 * reflow), persists it throttled (+ flush on unmount/tab-hide), and on each
 * chapter entry either restores a saved position or returns to the top.
 */
export function useScrollProgress({
  contentRef,
  chapterId,
  contentReady,
  savedPercentForChapter,
  onPersist,
}: UseScrollProgressOptions): { scrollPercent: number } {
  const [scrollPercent, setScrollPercent] = useState(0);
  const scrollPercentRef = useRef(savedPercentForChapter ?? 0);
  const rafRef = useRef<number | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enteredRef = useRef<string | null>(null);
  const userScrolledRef = useRef(false);
  const suppressUntilRef = useRef(0);

  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;

  useEffect(() => {
    const flush = () => onPersistRef.current(scrollPercentRef.current);
    const onVisibility = () => {
      if (document.hidden) flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

  useEffect(() => {
    userScrolledRef.current = false;
    const { target, element } = resolveScroller(contentRef.current);

    const handleScroll = () => {
      scrollPercentRef.current = currentFraction(element);
      if (Date.now() >= suppressUntilRef.current) {
        userScrolledRef.current = true;
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setScrollPercent(scrollPercentRef.current);
        });
      }
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        onPersistRef.current(scrollPercentRef.current);
      }, PERSIST_THROTTLE_MS);
    };

    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", handleScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [chapterId, contentRef]);

  useLayoutEffect(() => {
    if (!contentReady || enteredRef.current === chapterId) return;
    enteredRef.current = chapterId;
    userScrolledRef.current = false;
    suppressUntilRef.current = Date.now() + RESTORE_SUPPRESS_MS;
    const { element } = resolveScroller(contentRef.current);

    if (savedPercentForChapter == null) {
      element.scrollTop = 0;
      scrollPercentRef.current = 0;
      setScrollPercent(0);
      return;
    }

    const apply = () => {
      const max = element.scrollHeight - element.clientHeight;
      element.scrollTop = clamp01(savedPercentForChapter) * max;
      scrollPercentRef.current = currentFraction(element);
      setScrollPercent(scrollPercentRef.current);
    };

    // Double rAF lets initial layout settle; a delayed re-apply absorbs
    // late-loading images, unless the user has already taken over scrolling.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        apply();
        setTimeout(() => {
          if (!userScrolledRef.current) apply();
        }, RESTORE_REAPPLY_MS);
      });
    });
  }, [chapterId, contentReady, savedPercentForChapter, contentRef]);

  return { scrollPercent };
}
