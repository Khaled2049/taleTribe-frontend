import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RotateCcw, Sparkles } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/useDemoTimeline";

interface Choice {
  label: string;
  line: string;
}

const OPENING =
  "The lighthouse keeper found the letter on the forty-first step, dry, though it had rained all night.";

const ROUNDS: Choice[][] = [
  [
    {
      label: "She opens it",
      line: "Inside was a single line in her own handwriting, dated tomorrow.",
    },
    {
      label: "She tries to burn it",
      line: "The paper would not catch. The flame bent away from it, politely, like a guest.",
    },
    {
      label: "She reads the envelope",
      line: "It was addressed to the keeper. Not to her, but to whoever would keep the light after her.",
    },
  ],
  [
    {
      label: "Someone knocks",
      line: "Three knocks came from below, at the door no one had used since the war.",
    },
    {
      label: "The light goes out",
      line: "Above her, for the first time in ninety years, the great lamp went dark.",
    },
    {
      label: "A ship appears",
      line: "On the horizon a ship with no lights turned toward the rocks, and kept coming.",
    },
  ],
  [
    {
      label: "She goes to meet it",
      line: "She folded the letter into her coat and went down to meet whatever it was.",
    },
    {
      label: "She waits",
      line: "She sat on the forty-first step and waited, because the letter said she would.",
    },
    {
      label: "She writes back",
      line: "She found a pen, turned the letter over, and began her answer.",
    },
  ],
];

const TYPE_MS = 22;

/** The story assistant's choose-what-happens-next flow, scripted so it needs no account. */
export function CoWriteDemo() {
  const reduced = usePrefersReducedMotion();
  const [lines, setLines] = useState<string[]>([]);
  const [typed, setTyped] = useState(0);

  const round = lines.length;
  const latest = lines[round - 1] ?? "";
  const typing = round > 0 && typed < latest.length;
  const finished = round === ROUNDS.length && !typing;

  useEffect(() => {
    if (reduced || typed >= latest.length) return;
    const id = window.setTimeout(() => setTyped((n) => n + 1), TYPE_MS);
    return () => window.clearTimeout(id);
  }, [reduced, typed, latest]);

  const choose = (choice: Choice) => {
    setLines((prev) => [...prev, choice.line]);
    setTyped(reduced ? choice.line.length : 0);
  };

  const restart = () => {
    setLines([]);
    setTyped(0);
  };

  return (
    <div className="relative">
      <div
        className="absolute inset-0 translate-x-3 translate-y-3 rotate-[1.5deg] rounded-sm border border-ns-border-strong bg-ns-surface"
        aria-hidden="true"
      />
      <div className="relative rounded-sm border border-ns-border-strong bg-ns-elevated px-6 pb-6 pt-7 shadow-[0_24px_60px_-30px_var(--ns-shadow-strong)] sm:px-9 sm:pb-8 sm:pt-9">
        <p className="font-ui text-xs font-medium text-ns-ink-muted">
          Chapter one
        </p>

        <div
          className="mt-4 min-h-[13rem] font-body text-[1.15rem] leading-[1.75] text-ns-ink sm:text-[1.25rem]"
          aria-live="polite"
        >
          <p>
            <span className="float-left mr-2 mt-1 font-heading text-[3.4rem] font-semibold leading-[0.8] text-ns-accent">
              T
            </span>
            {OPENING.slice(1)}{" "}
            {lines.map((line, i) => {
              const isLatest = i === round - 1;
              const text = isLatest ? line.slice(0, typed) : line;
              return (
                <span
                  key={line}
                  className={
                    isLatest && typing
                      ? "bg-ns-accent-subtle"
                      : "transition-colors duration-700"
                  }
                >
                  {text}
                  {isLatest && typing && (
                    <span
                      className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-pulse bg-ns-accent"
                      aria-hidden="true"
                    />
                  )}{" "}
                </span>
              );
            })}
          </p>
        </div>

        <div className="mt-6 border-t border-dashed border-ns-border-strong pt-5">
          {finished ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-heading text-2xl font-medium leading-tight text-ns-ink">
                That's a story starting.
                <span className="block text-base font-normal text-ns-ink-secondary">
                  Keep it going with your own words.
                </span>
              </p>
              <div className="flex items-center gap-3">
                <Link
                  to="/sign-up"
                  className="inline-flex items-center rounded-full bg-ns-accent px-5 py-2.5 font-ui text-sm font-semibold text-[var(--ns-bg)] no-underline transition-colors hover:bg-ns-accent-hover hover:text-[var(--ns-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ns-elevated"
                >
                  Write the rest
                </Link>
                <button
                  type="button"
                  onClick={restart}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ns-border-strong text-ns-ink-secondary transition-colors hover:border-ns-accent hover:text-ns-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
                  aria-label="Start the story over"
                  title="Start over"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="flex items-center gap-2 font-ui text-sm font-medium text-ns-ink-secondary">
                <Sparkles
                  className="h-4 w-4 text-ns-accent"
                  aria-hidden="true"
                />
                What happens next?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(ROUNDS[round] ?? []).map((choice) => (
                  <button
                    key={choice.label}
                    type="button"
                    disabled={typing}
                    onClick={() => choose(choice)}
                    className="rounded-full border border-ns-border-strong bg-ns-bg px-4 py-2 font-ui text-sm text-ns-ink transition-colors hover:border-ns-accent hover:bg-ns-accent-subtle hover:text-ns-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:cursor-wait disabled:opacity-50"
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
