import { useState } from "react";
import { ChevronDown, Users } from "lucide-react";

import type { SpecialistView } from "./specialistView";

const sectionLabel =
  "font-ui text-[10px] font-semibold uppercase tracking-wide text-ns-ink-muted";

/** One specialist's take, attributed, collapsed to its analysis by default. */
export function SpecialistViewCard({ view }: { view: SpecialistView }) {
  const [open, setOpen] = useState(false);
  const extras =
    view.recommendations.length +
    view.suggestedChanges.length +
    view.risks.length;

  return (
    <section
      className="my-2 overflow-hidden rounded-ns-lg border border-ns-border bg-ns-surface/80 font-ui shadow-ns-sm"
      data-cy="assistant-specialist-view"
      aria-label={`${view.name}'s view`}
    >
      <header className="flex items-center gap-2 border-b border-ns-border px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ns-elevated text-ns-accent shadow-ns-sm">
          <Users className="h-3 w-3" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ns-ink">
          {view.name}
        </p>
        {view.reviewed && (
          <span className="shrink-0 rounded-full border border-ns-border-strong bg-ns-elevated px-2 py-0.5 text-[10px] font-semibold text-ns-ink-secondary">
            Weighed the others
          </span>
        )}
      </header>

      <div className="px-3 py-2.5">
        <p
          className={`whitespace-pre-wrap text-xs leading-5 text-ns-ink-secondary ${
            open ? "" : "line-clamp-4"
          }`}
        >
          {view.analysis}
        </p>

        {open && (
          <div className="mt-3 space-y-3">
            {view.recommendations.length > 0 && (
              <div>
                <p className={sectionLabel}>Recommends</p>
                <ul className="mt-1 space-y-1.5">
                  {view.recommendations.map((item) => (
                    <li key={item.title} className="text-xs leading-5">
                      <span className="font-semibold text-ns-ink">
                        {item.title}
                      </span>
                      {item.detail && (
                        <span className="text-ns-ink-secondary">
                          {" — "}
                          {item.detail}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {view.suggestedChanges.length > 0 && (
              <div>
                <p className={sectionLabel}>Would change</p>
                <ul className="mt-1 space-y-1.5">
                  {view.suggestedChanges.map((item) => (
                    <li
                      key={`${item.target}:${item.change}`}
                      className="text-xs leading-5 text-ns-ink-secondary"
                    >
                      {item.target && (
                        <span className="font-semibold text-ns-ink">
                          {item.target}:{" "}
                        </span>
                      )}
                      {item.change}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {view.risks.length > 0 && (
              <div>
                <p className={sectionLabel}>Risks</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {view.risks.map((risk) => (
                    <li
                      key={risk}
                      className="text-xs leading-5 text-ns-ink-secondary"
                    >
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="mt-2 inline-flex items-center gap-1 rounded-ns px-1.5 py-1 text-[10px] font-semibold text-ns-accent hover:bg-ns-accent-subtle"
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
          {open
            ? "Show less"
            : extras > 0
              ? `Show the full view (${extras} more)`
              : "Show the full view"}
        </button>
      </div>
    </section>
  );
}
