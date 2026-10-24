import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";

const select =
  "block appearance-none rounded-ns border border-ns-border bg-ns-elevated py-2 pl-3 pr-9 text-sm text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-50 dark:[color-scheme:dark]";

/** Native select with the arrow drawn inset, since the browser's sits flush right. */
export function AdminSelect({
  className = "",
  ...props
}: ComponentProps<"select">) {
  return (
    <span className={`relative block w-fit ${className}`}>
      <select {...props} className={select} />
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ns-ink-muted"
      />
    </span>
  );
}
