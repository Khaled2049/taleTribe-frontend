import React, { useId } from "react";
import type { PlotEventStatus } from "@/types/IPlot";
import { STATUS_OPTIONS } from "./plotOptions";

interface EventStatusControlProps {
  value: PlotEventStatus;
  onChange: (status: PlotEventStatus) => void;
  /** Names the group for screen readers, e.g. "Status of The Call". */
  label: string;
  size?: "sm" | "md";
}

export const EventStatusControl: React.FC<EventStatusControlProps> = ({
  value,
  onChange,
  label,
  size = "md",
}) => {
  const name = useId();
  return (
    <fieldset className="inline-flex rounded-ns border border-ns-border bg-ns-surface p-0.5">
      <legend className="sr-only">{label}</legend>
      {STATUS_OPTIONS.map((option) => (
        <label key={option.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={`block rounded-ns font-ui transition-colors text-ns-ink-secondary hover:text-ns-ink peer-checked:bg-ns-elevated peer-checked:text-ns-ink peer-checked:font-medium peer-checked:shadow-ns-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ns-accent ${
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
            }`}
          >
            {option.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
};
