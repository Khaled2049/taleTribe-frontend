import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const FIELD_LABEL =
  "mb-1.5 block font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted";

export const SettingsColumn = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="min-w-0">
    <h2 className="border-b border-ns-ink pb-3 font-heading text-2xl font-light text-ns-ink">
      {title}
    </h2>
    <div className="divide-y divide-ns-border">{children}</div>
  </div>
);

export const SettingsPanel = ({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <section className="py-7">
    <div className="flex min-h-8 items-center justify-between gap-4">
      <h3 className="font-ui text-[11px] font-semibold uppercase tracking-[0.16em] text-ns-ink-muted">
        {title}
      </h3>
      {meta}
    </div>
    {children && <div className="mt-5">{children}</div>}
  </section>
);

export const StatusDot = ({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "idle";
  children: React.ReactNode;
}) => (
  <span className="flex items-center gap-2 font-ui text-xs text-ns-ink-secondary">
    <span
      className={cn(
        "h-1.5 w-1.5 rounded-full",
        tone === "ok" && "bg-ns-success",
        tone === "warn" && "bg-ns-gold",
        tone === "idle" && "bg-ns-ink-muted",
      )}
    />
    {children}
  </span>
);

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex rounded-full border border-ns-border p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 font-ui text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-ring)]",
              "disabled:cursor-wait disabled:opacity-50",
              active
                ? "bg-ns-ink text-ns-bg"
                : "text-ns-ink-muted hover:text-ns-ink",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
