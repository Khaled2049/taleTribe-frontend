import { useState } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ROW_ACTION,
  ROW_ACTION_ORDER,
  actionBadgeProps,
} from "@/lib/competitionLedger";

/**
 * The ledger's status column header, with a panel explaining every value the
 * column can show.
 *
 * Hover-triggered, so it is a popover rather than a real modal — a dialog that
 * opened on pointer-over would trap focus every time the cursor crossed the
 * header. It also opens on keyboard focus and closes on Escape, so the same
 * explanation is reachable without a pointer.
 *
 * Entries come from ROW_ACTION, the map CompetitionLedgerRow picks from, so the
 * legend always lists exactly the pills the table can render.
 */
export function LedgerStatusLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative flex justify-end"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? "ledger-status-legend" : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="inline-flex items-center gap-1.5 font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted hover:text-ns-ink-secondary transition-colors"
      >
        Status
        <Info className="w-3 h-3" aria-hidden="true" />
        <span className="sr-only">What do these mean?</span>
      </button>

      {open && (
        <div
          id="ledger-status-legend"
          role="tooltip"
          className={cn(
            "absolute right-0 top-full z-30 mt-2 w-[330px]",
            "rounded-[14px] border border-ns-border bg-ns-elevated p-[18px] shadow-ns-lg",
            "animate-ns-fade-in motion-reduce:animate-none",
          )}
        >
          <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-ns-ink-muted mb-3.5">
            What each status means
          </p>

          <ul className="flex flex-col gap-3">
            {ROW_ACTION_ORDER.map((key) => {
              const action = ROW_ACTION[key];
              const badge = actionBadgeProps(action.tone);
              return (
                <li key={key} className="flex items-start gap-3">
                  <span className="shrink-0 w-[76px]">
                    <Badge variant={badge.variant} className={badge.className}>
                      {action.label}
                    </Badge>
                  </span>
                  <span className="font-body text-[14px] leading-[1.45] text-ns-ink-secondary">
                    {action.meaning}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default LedgerStatusLegend;
