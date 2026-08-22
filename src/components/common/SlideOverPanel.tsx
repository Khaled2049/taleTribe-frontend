import { X } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SlideOverPanelProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title: string;
  children: ReactNode;
}

export function SlideOverPanel({
  open,
  onClose,
  side = "right",
  title,
  children,
}: SlideOverPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-16 bottom-0 z-40 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close panel"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute top-0 bottom-0 z-50 w-full max-w-sm bg-ns-surface shadow-ns-lg animate-ns-slide-up",
          side === "left"
            ? "left-0 border-r border-ns-border"
            : "right-0 border-l border-ns-border",
        )}
      >
        <div className="flex items-center justify-between border-b border-ns-border px-4 py-3">
          <h2 className="font-ui text-sm font-semibold text-ns-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-ns p-1.5 text-ns-ink-muted hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
            aria-label={`Close ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(100%-49px)] overflow-y-auto">{children}</div>
      </section>
    </div>
  );
}
