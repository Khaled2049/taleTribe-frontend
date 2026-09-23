import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Pencil, Loader2, Check, X } from "lucide-react";

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  label: string;
  prefix?: string;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  className?: string;
}

export function EditableField({
  value,
  onSave,
  label,
  prefix,
  hint,
  placeholder = "Click to edit...",
  multiline = false,
  maxLength,
  className,
}: EditableFieldProps) {
  const inputId = React.useId();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("group", className)}>
        <label
          htmlFor={inputId}
          className="block font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-accent"
        >
          {label}
        </label>
        <div className="relative mt-2 border-b border-ns-accent pb-2">
          {multiline ? (
            <textarea
              id={inputId}
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={maxLength}
              disabled={isLoading}
              className={cn(
                "min-h-[92px] w-full resize-none bg-transparent p-0 font-body text-[15px] leading-relaxed",
                "text-ns-ink",
                "placeholder:text-ns-ink-muted",
                "focus:outline-none focus:ring-0",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              placeholder={placeholder}
            />
          ) : (
            <div className="flex items-baseline">
              {prefix && (
                <span className="shrink-0 pr-0.5 font-body text-lg text-ns-ink-muted">
                  {prefix}
                </span>
              )}
              <input
                id={inputId}
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={maxLength}
                disabled={isLoading}
                className={cn(
                  "min-w-0 flex-1 bg-transparent p-0 font-body text-lg",
                  "text-ns-ink",
                  "placeholder:text-ns-ink-muted",
                  "focus:outline-none focus:ring-0",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                placeholder={placeholder}
              />
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              {maxLength && (
                <span className="font-ui text-[10px] tabular-nums text-ns-ink-muted">
                  {editValue.length}/{maxLength}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isLoading ? (
                <span className="flex items-center gap-2 font-ui text-xs text-ns-ink-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-ns-accent" />
                  Saving
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-1.5 font-ui text-xs font-semibold text-ns-accent transition-colors hover:text-ns-accent-hover"
                    title="Save (Enter)"
                  >
                    <Check className="h-3.5 w-3.5" /> Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex items-center gap-1.5 font-ui text-xs text-ns-ink-muted transition-colors hover:text-ns-ink"
                    title="Cancel (Escape)"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        {error && (
          <p className="mt-2 font-ui text-xs text-ns-destructive">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("group", className)}>
      <span className="block font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-ink-muted transition-colors group-hover:text-ns-accent">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label={`Edit ${label.toLowerCase()}`}
        className={cn(
          "w-full cursor-pointer border-b border-ns-border py-2.5 text-left",
          "transition-colors duration-200 hover:border-ns-accent",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <span
            className={cn(
              multiline
                ? "font-body text-[15px] leading-relaxed"
                : "font-body text-lg",
              value ? "text-ns-ink" : "text-ns-ink-muted italic",
            )}
          >
            {prefix && value && (
              <span className="text-ns-ink-muted">{prefix}</span>
            )}
            {value || placeholder}
          </span>
          <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-ns-ink-muted transition-all group-hover:-translate-y-0.5 group-hover:text-ns-accent" />
        </div>
      </button>
      {hint && (
        <p className="mt-2 font-body text-xs leading-relaxed text-ns-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
