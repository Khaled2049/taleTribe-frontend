import { useEffect, useLayoutEffect, useRef, useState } from "react";

const PERSIST_THROTTLE_MS = 10000;
const RESTORE_SUPPRESS_MS = 500;
const RESTORE_REAPPLY_MS = 300;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function currentScrollPercent(): number {
  const max =
    document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? clamp01(window.scrollY / max) : 0;
}

interface UseScrollProgressOptions {
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
 * Tracks window scroll as a 0–1 fraction (robust to font-size reflow),
 * persists it throttled (+ flush on unmount/tab-hide), and restores a saved
 * position once per chapter entry after content has rendered.
 */
export function useScrollProgress({
  chapterId,
  contentReady,
  savedPercentForChapter,
  onPersist,
}: UseScrollProgressOptions): { scrollPercent: number } {
  const [scrollPercent, setScrollPercent] = useState(0);
  const scrollPercentRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore bookkeeping.
  const restoredForRef = useRef<string | null>(null);
  const userScrolledRef = useRef(false);
  const suppressUntilRef = useRef(0);

  // Keep the latest persist callback without re-subscribing the scroll listener.
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;

  // Flush the latest position on unmount and when the tab is hidden.
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

  // Live tracking + throttled persistence; re-subscribed per chapter.
  useEffect(() => {
    userScrolledRef.current = false;

    const handleScroll = () => {
      const p = currentScrollPercent();
      scrollPercentRef.current = p;
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

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [chapterId]);

  // Restore saved position once per chapter entry, after content is in the DOM.
  useLayoutEffect(() => {
    if (
      !contentReady ||
      savedPercentForChapter == null ||
      restoredForRef.current === chapterId
    ) {
      return;
    }
    restoredForRef.current = chapterId;
    userScrolledRef.current = false;
    suppressUntilRef.current = Date.now() + RESTORE_SUPPRESS_MS;

    const apply = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, clamp01(savedPercentForChapter) * max);
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
  }, [chapterId, contentReady, savedPercentForChapter]);

  return { scrollPercent };
}
