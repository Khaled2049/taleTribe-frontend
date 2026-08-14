import { useCallback, useEffect, useRef, useState } from "react";

/**
 * True when the reader has asked the OS for less motion.
 *
 * Read in an effect rather than during render (matching PeekingCat), and it
 * subscribes, so toggling the setting takes effect without a reload.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export interface DemoStep {
  /** Real milliseconds this step occupies during playback. */
  playMs: number;
  /**
   * Synthetic time on the clock when the step begins, in "story" milliseconds
   * (e.g. 5 days). Interpolated down to zero across the step, which is what
   * makes the countdown visibly run out. Omit for steps with no clock.
   */
  countdownFromMs?: number;
}

export interface DemoTimeline {
  index: number;
  /** 0 → 1 within the current step. */
  progress: number;
  playing: boolean;
  /**
   * Synthetic milliseconds left on the current step's clock, or null when the
   * step has none. Feed straight to `formatCountdown(remainingMs, 0)`.
   */
  remainingMs: number | null;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  toggle: () => void;
}

/** How often playback pushes a new progress value, in ms. */
const FRAME_MS = 40;

/**
 * Drives an autoplaying walkthrough with a simulated clock.
 *
 * Deliberately does NOT use `useNow` — that ticks at wall-clock speed, and the
 * whole point here is to compress days into seconds. Steps advance when their
 * own clock reaches zero, so the phase change reads as a *consequence* of time
 * running out rather than a slideshow that happens to move.
 *
 * Any manual control stops playback and leaves it stopped: a reader who has
 * taken over should not have the thing start moving under them again.
 */
export function useDemoTimeline(
  steps: DemoStep[],
  { autoplay = true }: { autoplay?: boolean } = {},
): DemoTimeline {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(autoplay);

  // Autoplay is a prop-derived default, so honour it changing (the caller flips
  // it off once reduced-motion resolves).
  useEffect(() => {
    setPlaying(autoplay);
  }, [autoplay]);

  const stepCount = steps.length;
  const playMs = steps[index]?.playMs ?? 1;

  // Re-runs whenever the step changes, which resets `elapsed` for free.
  const rafRef = useRef(0);
  useEffect(() => {
    if (!playing || stepCount === 0) return;

    let last = performance.now();
    let elapsed = 0;
    let sinceRender = 0;

    const tick = (time: number) => {
      const delta = time - last;
      last = time;
      elapsed += delta;
      sinceRender += delta;

      if (elapsed >= playMs) {
        setProgress(0);
        setIndex((current) => (current + 1) % stepCount);
        return; // the effect re-runs for the next step
      }

      // Throttled: the clock shows whole days/hours/minutes, so painting every
      // frame would re-render the subtree ~60x a second to no visible effect.
      if (sinceRender >= FRAME_MS) {
        sinceRender = 0;
        setProgress(elapsed / playMs);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, index, playMs, stepCount]);

  const goTo = useCallback(
    (target: number) => {
      if (stepCount === 0) return;
      setPlaying(false);
      setProgress(0);
      setIndex(((target % stepCount) + stepCount) % stepCount);
    },
    [stepCount],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const toggle = useCallback(() => setPlaying((current) => !current), []);

  const countdownFromMs = steps[index]?.countdownFromMs;
  const remainingMs =
    countdownFromMs === undefined
      ? null
      : Math.max(0, Math.round(countdownFromMs * (1 - progress)));

  return { index, progress, playing, remainingMs, goTo, next, prev, toggle };
}
