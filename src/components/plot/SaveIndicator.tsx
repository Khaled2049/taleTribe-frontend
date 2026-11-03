import React from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { EventSaveState } from "./eventSaveQueue";

interface SaveIndicatorProps {
  state: EventSaveState | null;
  onRetry: () => void;
  onReload: () => void;
}

const actionClass =
  "underline underline-offset-2 font-medium hover:text-ns-ink transition-colors";

export const SaveIndicator: React.FC<SaveIndicatorProps> = ({
  state,
  onRetry,
  onReload,
}) => (
  <span
    aria-live="polite"
    className="inline-flex items-center gap-1.5 font-ui text-xs min-h-[1.5rem]"
  >
    {(state === "pending" || state === "saving") && (
      <span className="inline-flex items-center gap-1.5 text-ns-ink-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        Saving…
      </span>
    )}
    {state === "saved" && (
      <span className="inline-flex items-center gap-1.5 text-ns-ink-muted">
        <Check className="w-3.5 h-3.5" aria-hidden />
        Saved
      </span>
    )}
    {state === "error" && (
      <span className="inline-flex items-center gap-1.5 text-ns-destructive">
        <AlertCircle className="w-3.5 h-3.5" aria-hidden />
        Couldn't save —
        <button type="button" onClick={onRetry} className={actionClass}>
          Retry
        </button>
      </span>
    )}
    {state === "conflict" && (
      <span className="inline-flex items-center gap-1.5 text-ns-destructive">
        <AlertCircle className="w-3.5 h-3.5" aria-hidden />
        An event changed somewhere else —
        <button type="button" onClick={onReload} className={actionClass}>
          Reload it
        </button>
      </span>
    )}
  </span>
);
