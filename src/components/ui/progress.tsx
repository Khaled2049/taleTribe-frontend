import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. Values outside that range are clamped. */
  value: number;
  indicatorClassName?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, indicatorClassName, ...props }, ref) => {
    const pct = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          "relative h-1 w-full overflow-hidden rounded-full bg-ns-border",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full rounded-full bg-ns-accent transition-[width] duration-700 ease-ns-smooth",
            indicatorClassName,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
