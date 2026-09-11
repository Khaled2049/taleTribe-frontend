import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  variant?: "danger" | "default";
  isLoading?: boolean;
  /** Single-button mode for notices that aren't really a confirm/cancel choice. */
  hideCancel?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "default",
  isLoading = false,
  hideCancel = false,
}: ConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const loading = isLoading || isPending;

  const handleConfirm = async () => {
    if (loading) return;
    setIsPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsPending(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!loading) onOpenChange(nextOpen);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/80",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-md",
            "translate-x-[-50%] translate-y-[-50%]",
            "border border-gray-200 dark:border-gray-800",
            "bg-white dark:bg-gray-900",
            "text-gray-900 dark:text-gray-100",
            "p-6 shadow-lg rounded-lg",
            "duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {/* Header with icon for danger variant */}
          <div className="flex items-start gap-4">
            {variant === "danger" && (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
            )}
            <div className="flex-1">
              <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {description}
              </DialogPrimitive.Description>
            </div>
          </div>

          {/* Footer with buttons */}
          <div className="flex justify-end gap-3 mt-6">
            {!hideCancel && (
              <button
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg",
                  "border border-gray-300 dark:border-gray-600",
                  "bg-white dark:bg-gray-800",
                  "text-gray-700 dark:text-gray-300",
                  "hover:bg-gray-50 dark:hover:bg-gray-700",
                  "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-colors duration-200",
                )}
              >
                {cancelLabel}
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg text-white",
                "focus:outline-none focus:ring-2 focus:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors duration-200",
                variant === "danger"
                  ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                  : "bg-dark-green dark:bg-light-green hover:bg-light-green dark:hover:bg-dark-green focus:ring-dark-green dark:focus:ring-light-green",
              )}
            >
              {loading ? "..." : confirmLabel}
            </button>
          </div>

          {/* Close button */}
          <DialogPrimitive.Close
            disabled={loading}
            className={cn(
              "absolute right-4 top-4 rounded-sm opacity-70",
              "transition-opacity hover:opacity-100",
              "focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2",
              "disabled:pointer-events-none",
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Specialized variant for unsaved changes
interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAndContinue: () => void;
  onDiscardAndContinue: () => void;
  isSaving?: boolean;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSaveAndContinue,
  onDiscardAndContinue,
  isSaving = false,
}: UnsavedChangesDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/80",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-md",
            "translate-x-[-50%] translate-y-[-50%]",
            "border border-gray-200 dark:border-gray-800",
            "bg-white dark:bg-gray-900",
            "text-gray-900 dark:text-gray-100",
            "p-6 shadow-lg rounded-lg",
            "duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
                Unsaved Changes
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                You have unsaved changes. Would you like to save before
                continuing?
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg",
                "border border-gray-300 dark:border-gray-600",
                "bg-white dark:bg-gray-800",
                "text-gray-700 dark:text-gray-300",
                "hover:bg-gray-50 dark:hover:bg-gray-700",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors duration-200",
              )}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onDiscardAndContinue();
                onOpenChange(false);
              }}
              disabled={isSaving}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg",
                "border border-red-300 dark:border-red-600",
                "bg-white dark:bg-gray-800",
                "text-red-600 dark:text-red-400",
                "hover:bg-red-50 dark:hover:bg-red-900/20",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors duration-200",
              )}
            >
              Discard
            </button>
            <button
              onClick={() => {
                onSaveAndContinue();
                onOpenChange(false);
              }}
              disabled={isSaving}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg text-white",
                "bg-dark-green dark:bg-light-green",
                "hover:bg-light-green dark:hover:bg-dark-green",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-dark-green dark:focus:ring-light-green",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors duration-200",
              )}
            >
              {isSaving ? "Saving..." : "Save & Continue"}
            </button>
          </div>

          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4 rounded-sm opacity-70",
              "transition-opacity hover:opacity-100",
              "focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2",
              "disabled:pointer-events-none",
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
