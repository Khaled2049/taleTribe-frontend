import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Loader } from "lucide-react";

const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-ns px-3 py-1.5 font-ui text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function SaveConflictDialog({
  open,
  onOpenChange,
  onKeepMine,
  onLoadTheirs,
  resolving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeepMine: () => void;
  onLoadTheirs: () => void;
  resolving: boolean;
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!resolving) onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-ns-lg border border-ns-border bg-ns-elevated p-6 text-ns-ink shadow-ns-lg">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ns-accent-subtle">
              <AlertTriangle className="h-5 w-5 text-ns-accent" />
            </div>
            <div className="flex-1">
              <DialogPrimitive.Title className="font-heading text-lg text-ns-ink">
                This chapter changed somewhere else
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 font-ui text-sm text-ns-ink-secondary">
                It was saved from another tab, a connected app or another device
                after you opened it, so your latest edits here are not saved
                yet. Choose which version to keep. The other one is replaced.
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={resolving}
              className={`${buttonClass} text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink`}
            >
              Decide later
            </button>
            <button
              type="button"
              onClick={onLoadTheirs}
              disabled={resolving}
              className={`${buttonClass} border border-ns-border text-ns-ink hover:bg-ns-surface-hover`}
            >
              Load the other version
            </button>
            <button
              type="button"
              onClick={onKeepMine}
              disabled={resolving}
              className={`${buttonClass} bg-ns-accent text-white hover:bg-ns-accent-hover`}
            >
              {resolving && <Loader className="h-3.5 w-3.5 animate-spin" />}
              Keep my version
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
