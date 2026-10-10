import type { ComponentPropsWithRef } from "react";
import { MessageCircle, PanelRightOpen } from "lucide-react";
import { sidebarShortcutLabel } from "@/lib/sidebarShortcut";

export function AssistantRail({ onOpen }: { onOpen: () => void }) {
  return (
    <aside className="flex h-full w-12 shrink-0 flex-col items-center border-l border-ns-border bg-ns-surface py-3 text-ns-ink">
      <button
        type="button"
        data-cy="open-chat"
        onClick={onOpen}
        aria-label="Open story assistant"
        title={`Open story assistant (${sidebarShortcutLabel("right")})`}
        className="group flex h-9 w-9 items-center justify-center rounded-ns-lg border border-ns-border bg-ns-elevated text-ns-accent shadow-ns-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-ns-accent hover:shadow-ns motion-reduce:transform-none"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>
      <span className="mt-4 select-none font-ui text-[9px] font-semibold uppercase tracking-[0.18em] text-ns-ink-muted [writing-mode:vertical-rl]">
        Assistant
      </span>
    </aside>
  );
}

/** Spreads its props so it can sit under a Radix `Dialog.Trigger asChild`. */
export function AssistantFab(props: ComponentPropsWithRef<"button">) {
  return (
    <button
      type="button"
      data-cy="open-chat"
      className="fixed bottom-24 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-ns-accent text-white shadow-ns-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-ns-accent-hover active:scale-95 motion-reduce:transform-none motion-reduce:transition-none md:right-6"
      aria-label="Open story assistant"
      title="Story assistant"
      {...props}
    >
      <MessageCircle className="h-5 w-5" />
    </button>
  );
}

/** Holds the open dock's width while the panel is not mounted yet. */
export function AssistantDockPlaceholder({ width }: { width: number }) {
  return (
    <div
      aria-hidden
      className="h-full shrink-0 animate-pulse border-l border-ns-border bg-ns-surface motion-reduce:animate-none"
      style={{ width: `${width}px` }}
    />
  );
}
