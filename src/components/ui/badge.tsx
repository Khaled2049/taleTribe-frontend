import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "gold" | "success" | "outline";
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-ns-surface text-ns-ink-secondary border border-ns-border",
  accent: "bg-ns-accent text-white",
  gold: "bg-ns-gold-bright/15 text-ns-gold-bright",
  success: "bg-ns-success/15 text-ns-success",
  outline: "border border-ns-border-strong text-ns-ink-secondary",
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 font-ui text-xs font-semibold",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";

export { Badge };
