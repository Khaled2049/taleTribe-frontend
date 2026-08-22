import * as React from "react";
import { Search, X } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchFieldProps extends Omit<
  InputProps,
  "type" | "value" | "onChange"
> {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  onClear?: () => void;
}

const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = "Search stories...",
      ariaLabel = "Search stories",
      className,
      ...props
    },
    ref,
  ) => {
    const handleClear = () => {
      if (onClear) {
        onClear();
        return;
      }

      onChange("");
    };

    return (
      <div role="search" className={cn("relative", className)}>
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ns-ink-muted pointer-events-none"
          aria-hidden="true"
        />
        <Input
          ref={ref}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          enterKeyHint="search"
          className="h-10 pl-9 pr-10 font-ui"
          {...props}
        />
        {value.trim() && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-ns p-1 text-ns-ink-muted transition-colors hover:text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-ring)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);

SearchField.displayName = "SearchField";

export default SearchField;
