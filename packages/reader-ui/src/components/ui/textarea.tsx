import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-ns border border-ns-border bg-ns-elevated px-3 py-2 text-sm text-ns-ink shadow-ns-sm transition-all duration-200 placeholder:text-ns-ink-muted focus-visible:outline-none focus-visible:border-ns-accent focus-visible:ring-2 focus-visible:ring-[var(--ns-ring)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
