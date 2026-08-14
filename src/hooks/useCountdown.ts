import { useEffect, useState } from "react";

/**
 * A single ticking clock, shared by every countdown on a page — callers pass
 * the resulting `now` into `formatCountdown` rather than each owning an
 * interval. Pauses while the tab is hidden so a backgrounded page doesn't
 * keep re-rendering every second for nothing.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (document.visibilityState === "hidden") return;

    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return now;
}

/** Flips a countdown's display to the urgency accent inside this window. */
export const URGENT_THRESHOLD_MS = 72 * 60 * 60 * 1000;

export interface CountdownInfo {
  /** "6d 14h" -> "14h 22m" -> "22m 08s", or "Closed" once past. */
  label: string;
  /** Same breakdown, for callers that want to render units separately (e.g. the sticky entry card's day/hr/min tiles). */
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isUrgent: boolean;
  isPast: boolean;
}

/** Pure so it's cheap to call per-row without its own interval. */
export function formatCountdown(
  deadline: Date | number,
  now: number,
): CountdownInfo {
  const deadlineMs = deadline instanceof Date ? deadline.getTime() : deadline;
  const diff = deadlineMs - now;

  if (diff <= 0) {
    return {
      label: "Closed",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isUrgent: false,
      isPast: true,
    };
  }

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((diff % (60 * 1000)) / 1000);

  const label =
    days > 0
      ? `${days}d ${hours}h`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m ${String(seconds).padStart(2, "0")}s`;

  return {
    label,
    days,
    hours,
    minutes,
    seconds,
    isUrgent: diff <= URGENT_THRESHOLD_MS,
    isPast: false,
  };
}
