import { Check, History, Loader2, SquarePen, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AssistantThread } from "@novelsync/story-data-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  AssistantThreadSession,
  ConversationTarget,
} from "./assistantHistory";

const UNTITLED = "New conversation";

function relativeDay(value: Date): string {
  const day = 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - value.getTime();
  if (elapsed < day) return "Today";
  if (elapsed < 2 * day) return "Yesterday";
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)} days ago`;
  return value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AssistantThreadControls({
  session,
  target,
  activeTitle,
  onSelect,
  disabled,
}: {
  session: AssistantThreadSession;
  target: ConversationTarget;
  activeTitle: string | null;
  onSelect: (target: ConversationTarget) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<AssistantThread[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setThreads(await session.listThreads());
    } catch {
      setThreads([]);
    } finally {
      setBusy(false);
    }
  }, [session]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const activeId = session.current()?.id;
  const label = target.mode === "new" ? UNTITLED : (activeTitle ?? UNTITLED);

  const discard = async (thread: AssistantThread) => {
    await session.archive(thread).catch(() => undefined);
    if (thread.id === activeId) onSelect({ mode: "latest" });
    void refresh();
  };

  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-cy="assistant-thread-switcher"
            aria-label="Switch conversation"
            className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-ns border border-ns-border bg-ns-elevated px-2.5 py-1.5 text-left font-ui text-[11px] leading-4 text-ns-ink-secondary shadow-ns-sm transition-colors hover:bg-ns-surface-hover hover:text-ns-ink disabled:opacity-50"
            disabled={disabled}
          >
            <History className="h-3.5 w-3.5 shrink-0 text-ns-ink-muted transition-colors group-hover:text-ns-accent" />
            <span className="truncate">{label}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-[min(22rem,60vh)] w-[min(20rem,calc(100vw-2.5rem))] overflow-y-auto"
        >
          <DropdownMenuLabel className="font-ui text-[11px] uppercase tracking-wide text-ns-ink-muted">
            Conversations
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {busy && threads === null ? (
            <div className="flex items-center gap-2 px-2 py-3 font-ui text-[11px] text-ns-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              Loading conversations
            </div>
          ) : null}
          {threads?.length === 0 ? (
            <div className="px-2 py-3 font-ui text-[11px] text-ns-ink-muted">
              No saved conversations yet.
            </div>
          ) : null}
          {threads?.map((thread) => (
            <DropdownMenuItem
              key={thread.id}
              data-cy="assistant-thread-option"
              className="group/item flex items-start gap-2"
              onSelect={() =>
                onSelect({ mode: "thread", threadId: thread.id })
              }
            >
              <Check
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                  thread.id === activeId && target.mode !== "new"
                    ? "text-ns-accent"
                    : "invisible"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ns-ink">
                  {thread.title}
                </span>
                <span className="mt-0.5 block font-ui text-[10px] text-ns-ink-muted">
                  {relativeDay(thread.updatedAt)} ·{" "}
                  {thread.messageCount === 1
                    ? "1 message"
                    : `${thread.messageCount} messages`}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${thread.title}`}
                data-cy="assistant-thread-remove"
                className="mt-0.5 rounded-ns p-1 text-ns-ink-muted opacity-0 transition-opacity hover:text-ns-destructive focus:opacity-100 group-hover/item:opacity-100"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void discard(thread);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        data-cy="assistant-new-thread"
        aria-label="Start a new conversation"
        title="New conversation"
        className="flex shrink-0 items-center gap-1.5 rounded-ns border border-ns-border bg-ns-elevated px-2.5 py-1.5 font-ui text-[11px] leading-4 text-ns-ink-secondary shadow-ns-sm transition-colors hover:bg-ns-surface-hover hover:text-ns-accent disabled:opacity-50"
        disabled={disabled}
        onClick={() => onSelect({ mode: "new", nonce: Date.now() })}
      >
        <SquarePen className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">New</span>
      </button>
    </div>
  );
}
