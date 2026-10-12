import { useId } from "react";
import type { CompletionStatus } from "@novelsync/story-data-client";
import { STATUS_LABELS } from "@/lib/storyStatus";

export function StoryCompletionPicker({
  value,
  onChange,
}: {
  value: CompletionStatus;
  onChange: (value: CompletionStatus) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 font-ui text-xs font-semibold uppercase tracking-widest text-ns-ink-muted">
        Story status
      </legend>
      <div className="inline-flex overflow-hidden rounded-ns border border-ns-border">
        {(["ongoing", "completed"] as const).map((status) => (
          <label key={status} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={status}
              checked={value === status}
              onChange={() => onChange(status)}
              className="peer sr-only"
            />
            <span className="block bg-ns-surface px-4 py-1.5 font-ui text-sm text-ns-ink-secondary transition-colors hover:bg-ns-surface-hover peer-checked:bg-ns-accent peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-[var(--ns-ring)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
              {STATUS_LABELS[status]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
