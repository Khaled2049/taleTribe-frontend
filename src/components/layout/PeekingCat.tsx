import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A cute cat that peeks up from behind the footer's top edge at random
 * intervals, then ducks back down. Rendered behind the footer (z-0) so the
 * footer's solid background hides its body — only the head + paws clear the
 * edge while peeking. Hovering the cat scares it back down early.
 *
 * Purely decorative: hidden from assistive tech and respects
 * `prefers-reduced-motion`.
 */
const PeekingCat: React.FC = () => {
  const [peeking, setPeeking] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const scheduleNext = useCallback(() => {
    clearTimeout(showTimer.current);
    clearTimeout(hideTimer.current);
    // Stay hidden 4–10s between appearances.
    const hiddenFor = 4000 + Math.random() * 6000;
    showTimer.current = setTimeout(() => {
      setPeeking(true);
      // Linger for 3.5–5.5s, then duck back down.
      const visibleFor = 3500 + Math.random() * 2000;
      hideTimer.current = setTimeout(() => {
        setPeeking(false);
        scheduleNext();
      }, visibleFor);
    }, hiddenFor);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    scheduleNext();
    return () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    };
  }, [scheduleNext]);

  // Hovering scares the cat: duck down now and restart the wait cycle.
  const handleScare = useCallback(() => {
    if (!peeking) return;
    setPeeking(false);
    scheduleNext();
  }, [peeking, scheduleNext]);

  return (
    <div
      aria-hidden="true"
      onMouseEnter={handleScare}
      className={`absolute left-6 top-0 z-0 sm:left-12 transition-transform duration-700 ease-out ${
        peeking
          ? "-translate-y-[64%] cursor-pointer"
          : "pointer-events-none translate-y-1"
      }`}
    >
      <svg
        width="64"
        height="84"
        viewBox="0 0 64 84"
        fill="none"
        className="text-ns-ink drop-shadow-sm"
      >
        {/* Ears */}
        <path d="M14 30 L10 12 L26 22 Z" fill="currentColor" />
        <path d="M50 30 L54 12 L38 22 Z" fill="currentColor" />
        {/* Inner ears */}
        <path d="M15 26 L13 16 L22 22 Z" className="fill-ns-accent" />
        <path d="M49 26 L51 16 L42 22 Z" className="fill-ns-accent" />

        {/* Head */}
        <ellipse cx="32" cy="40" rx="24" ry="22" fill="currentColor" />

        {/* Eyes (sclera) */}
        <g className="animate-cat-blink">
          <circle cx="23" cy="38" r="8.5" fill="#FFFFFF" />
          <circle cx="41" cy="38" r="8.5" fill="#FFFFFF" />
          {/* Pupils */}
          <circle cx="24" cy="39" r="5" fill="#1f2937" />
          <circle cx="40" cy="39" r="5" fill="#1f2937" />
          {/* Highlights */}
          <circle cx="22" cy="36.5" r="1.8" fill="#FFFFFF" />
          <circle cx="38" cy="36.5" r="1.8" fill="#FFFFFF" />
        </g>

        {/* Nose */}
        <path d="M30 47 L34 47 L32 50 Z" className="fill-ns-accent" />
        {/* Mouth */}
        <path
          d="M32 50 Q32 53 29 53 M32 50 Q32 53 35 53"
          stroke="#1f2937"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Whiskers */}
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <line x1="16" y1="46" x2="2" y2="44" />
          <line x1="16" y1="49" x2="3" y2="50" />
          <line x1="48" y1="46" x2="62" y2="44" />
          <line x1="48" y1="49" x2="61" y2="50" />
        </g>

        {/* Paws gripping the edge */}
        <ellipse cx="18" cy="66" rx="7" ry="5" fill="currentColor" />
        <ellipse cx="46" cy="66" rx="7" ry="5" fill="currentColor" />
        <g
          stroke="#1f2937"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.5"
        >
          <line x1="15" y1="64" x2="15" y2="68" />
          <line x1="18" y1="64" x2="18" y2="68.5" />
          <line x1="21" y1="64" x2="21" y2="68" />
          <line x1="43" y1="64" x2="43" y2="68" />
          <line x1="46" y1="64" x2="46" y2="68.5" />
          <line x1="49" y1="64" x2="49" y2="68" />
        </g>
      </svg>
    </div>
  );
};

export default PeekingCat;
