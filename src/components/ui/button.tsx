import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-ns text-sm font-medium font-ui transition-all duration-200 ease-ns-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ns-ring-offset)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";

    const variantStyles = {
      default: "bg-ns-accent text-white shadow-ns-sm hover:bg-ns-accent-hover",
      destructive:
        "bg-ns-destructive text-white shadow-ns-sm hover:bg-ns-destructive-hover",
      outline:
        "border border-ns-border bg-ns-elevated shadow-ns-sm hover:bg-ns-surface hover:border-ns-border-strong text-ns-ink",
      secondary:
        "bg-ns-surface text-ns-ink shadow-ns-sm hover:bg-ns-surface-hover",
      ghost: "text-ns-ink-secondary hover:bg-ns-surface hover:text-ns-ink",
      link: "text-ns-accent underline-offset-4 hover:underline",
    };

    const sizeStyles = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-ns px-3 text-xs",
      lg: "h-10 rounded-ns-lg px-8",
      icon: "h-9 w-9",
    };

    return (
      <button
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
