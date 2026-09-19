import { Archive, MessagesSquare, PenLine } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AssistantThread } from "@novelsync/story-data-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  AssistantThreadSession,
  ConversationTarget,
} from "./assistantHistory";

const UNTITLED = "New chat";
const STAGGER_MS = 40;

function whenLabel(value: Date): string {
  const day = 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - value.getTime();
  if (elapsed < day) return "Today";
  if (elapsed < 2 * day) return "Yesterday";
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)} days ago`;
  return value.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function lengthLabel(count: number): string {
  if (count <= 1) return "Just started";
  if (count < 6) return "A short chat";
  if (count < 20) return "A good long chat";
  return "A very long chat";
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
  const [ripple, setRipple] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setThreads(await session.listThreads());
    } catch {
      setThreads([]);
    }
  }, [session]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const activeId = session.current()?.id;
  const onNewChat = target.mode === "new";
  const label = onNewChat ? UNTITLED : (activeTitle ?? UNTITLED);

  const hide = async (thread: AssistantThread) => {
    setThreads((current) =>
      (current ?? []).filter((row) => row.id !== thread.id),
    );
    await session.archive(thread).catch(() => undefined);
    if (thread.id === activeId) onSelect({ mode: "latest" });
  };

  const startNewChat = () => {
    setRipple((count) => count + 1);
    onSelect({ mode: "new", nonce: Date.now() });
  };

  return (
    <div className="relative mt-3 flex items-center gap-2 animate-ns-slide-down motion-reduce:animate-none">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-cy="assistant-thread-switcher"
            aria-label="Choose a chat"
            title="Your saved chats"
            disabled={disabled}
            className="group flex min-w-0 flex-1 items-center gap-2 rounded-ns-lg border border-ns-border bg-ns-elevated px-3 py-2 text-left shadow-ns-sm transition-all duration-200 ease-ns-spring hover:border-ns-border-strong hover:bg-ns-surface-hover disabled:opacity-50 motion-reduce:transition-none"
          >
            <MessagesSquare className="h-4 w-4 shrink-0 text-ns-ink-muted transition-colors duration-200 group-hover:text-ns-accent" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-ui text-[12px] leading-4 text-ns-ink">
                {label}
              </span>
              <span className="block font-ui text-[10px] leading-4 text-ns-ink-muted">
                Tap to see your other chats
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-[min(24rem,60vh)] w-[min(21rem,calc(100vw-2.5rem))] overflow-y-auto p-1.5"
        >
          <p className="px-2 pb-1.5 pt-1 font-ui text-[11px] leading-4 text-ns-ink-muted">
            Every chat about this story is saved here.
          </p>
          {threads?.length === 0 ? (
            <p className="px-2 pb-2 pt-1 font-ui text-[12px] leading-5 text-ns-ink-secondary">
              This is your first chat. Once you have a few, you can come back to
              any of them here.
            </p>
          ) : null}
          {threads?.map((thread, index) => {
            const active = thread.id === activeId && !onNewChat;
            return (
              <DropdownMenuItem
                key={thread.id}
                data-cy="assistant-thread-option"
                className="group/item mb-0.5 flex items-center gap-2.5 rounded-ns px-2 py-2 animate-ns-fade-in motion-reduce:animate-none"
                style={{ animationDelay: `${index * STAGGER_MS}ms` }}
                onSelect={() => onSelect({ mode: "thread", threadId: thread.id })}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    active
                      ? "bg-ns-accent animate-ns-glow-pulse motion-reduce:animate-none"
                      : "bg-ns-border-strong"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-[14px] leading-5 text-ns-ink">
                    {thread.title}
                  </span>
                  <span className="block font-ui text-[10px] leading-4 text-ns-ink-muted">
                    {whenLabel(thread.updatedAt)} ·{" "}
                    {lengthLabel(thread.messageCount)}
                    {active ? " · You are here" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Hide the chat "${thread.title}"`}
                  title="Hide this chat"
                  data-cy="assistant-thread-remove"
                  className="shrink-0 rounded-ns p-1.5 text-ns-ink-muted opacity-0 transition-all duration-200 hover:bg-ns-surface-hover hover:text-ns-ink focus-visible:opacity-100 group-hover/item:opacity-100 motion-reduce:transition-none"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void hide(thread);
                  }}
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        data-cy="assistant-new-thread"
        aria-label="Start a new chat"
        title={
          disabled
            ? "You can start a new chat once the assistant finishes"
            : "Start a fresh chat about this story"
        }
        disabled={disabled}
        onClick={startNewChat}
        className="relative shrink-0 overflow-hidden rounded-ns-lg border border-ns-border bg-ns-elevated px-3 py-2 font-ui text-[12px] leading-4 text-ns-ink-secondary shadow-ns-sm transition-all duration-200 ease-ns-spring hover:-translate-y-0.5 hover:border-ns-accent hover:text-ns-accent active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
      >
        {ripple > 0 ? (
          <span
            key={ripple}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-ns-lg bg-ns-accent-subtle animate-ns-ink-spread motion-reduce:animate-none"
          />
        ) : null}
        <span className="relative flex items-center gap-1.5">
          <PenLine className="h-3.5 w-3.5" />
          New chat
        </span>
      </button>
    </div>
  );
}
