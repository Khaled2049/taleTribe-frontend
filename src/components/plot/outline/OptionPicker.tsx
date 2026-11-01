import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OptionPickerProps<T extends string> {
  /** What the value is, for the accessible name: "Pacing", "Beat". */
  label: string;
  eventName: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  /** Saves at once: picking a value is the whole action. */
  onChange: (value: T) => void;
}

/** A small chip on an event card that changes one fixed-choice field. */
export function OptionPicker<T extends string>({
  label,
  eventName,
  options,
  value,
  onChange,
}: OptionPickerProps<T>) {
  const current = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label} for ${eventName}: ${current?.label ?? value}. Change ${label.toLowerCase()}`}
        className="inline-flex items-center gap-1 rounded-full border border-ns-border px-2 py-0.5 font-ui text-[11px] text-ns-ink-secondary transition-colors hover:border-ns-border-strong hover:text-ns-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
      >
        <span className="text-ns-ink-muted">{label}:</span>
        <span>{current?.label ?? value}</span>
        <ChevronDown className="h-3 w-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[180px] rounded-ns-lg border border-ns-border bg-ns-elevated p-1 shadow-ns-lg"
      >
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as T)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="cursor-pointer rounded-ns py-1.5 pr-3 font-ui text-sm text-ns-ink"
            >
              <span className="flex flex-col">
                <span>{option.label}</span>
                {option.description && (
                  <span className="text-[11px] text-ns-ink-muted">
                    {option.description}
                  </span>
                )}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
