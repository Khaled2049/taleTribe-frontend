import { Archive, PenLine } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AssistantThread } from "@novelsync/story-data-client";
import type {
  AssistantThreadSession,
  ConversationTarget,
} from "./assistantHistory";

const UNTITLED = "New chat";
const STAGGER_MS = 35;

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

export function AssistantThreadList({
  session,
  target,
  onSelect,
}: {
  session: AssistantThreadSession;
  target: ConversationTarget;
  onSelect: (target: ConversationTarget) => void;
}) {
  const [threads, setThreads] = useState<AssistantThread[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setThreads(await session.listThreads());
    } catch {
      setThreads([]);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeId = session.current()?.id;
  const onNewChat = target.mode === "new";

  const hide = async (thread: AssistantThread) => {
    setThreads((current) =>
      (current ?? []).filter((row) => row.id !== thread.id),
    );
    await session.archive(thread).catch(() => undefined);
    if (thread.id === activeId) onSelect({ mode: "latest" });
  };

  return (
    <div
      data-cy="assistant-thread-list"
      className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
    >
      {threads === null ? (
        <p className="px-2 py-3 font-ui text-[11px] text-ns-ink-muted">
          Looking for your chats…
        </p>
      ) : null}
      {threads?.length === 0 ? (
        <p className="px-2 py-3 font-ui text-[12px] leading-5 text-ns-ink-secondary">
          This is your first chat. Once you have a few, every one of them shows
          up here.
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {threads?.map((thread, index) => {
          const active = thread.id === activeId && !onNewChat;
          return (
            <li
              key={thread.id}
              className="animate-ns-fade-in motion-reduce:animate-none"
              style={{ animationDelay: `${index * STAGGER_MS}ms` }}
            >
              <div
                className={`group/item flex items-center gap-2.5 rounded-ns px-2 py-2 transition-colors ${
                  active ? "bg-ns-accent-subtle" : "hover:bg-ns-surface-hover"
                }`}
              >
                <button
                  type="button"
                  data-cy="assistant-thread-option"
                  onClick={() =>
                    onSelect({ mode: "thread", threadId: thread.id })
                  }
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
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
                      {thread.title || UNTITLED}
                    </span>
                    <span className="block font-ui text-[10px] leading-4 text-ns-ink-muted">
                      {whenLabel(thread.updatedAt)} ·{" "}
                      {lengthLabel(thread.messageCount)}
                      {active ? " · You are here" : ""}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Hide the chat "${thread.title || UNTITLED}"`}
                  title="Hide this chat"
                  data-cy="assistant-thread-remove"
                  className="shrink-0 rounded-ns p-1.5 text-ns-ink-muted opacity-0 transition-all duration-200 hover:bg-ns-surface-hover hover:text-ns-ink focus-visible:opacity-100 group-hover/item:opacity-100 motion-reduce:transition-none"
                  onClick={() => void hide(thread)}
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AssistantNewChatRow({
  activeTitle,
  target,
  disabled,
  onSelect,
}: {
  activeTitle: string | null;
  target: ConversationTarget;
  disabled: boolean;
  onSelect: (target: ConversationTarget) => void;
}) {
  const [ripple, setRipple] = useState(0);
  const label = target.mode === "new" ? UNTITLED : (activeTitle ?? UNTITLED);

  return (
    <div className="mb-2 flex items-center justify-between gap-3">
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
        onClick={() => {
          setRipple((count) => count + 1);
          onSelect({ mode: "new", nonce: Date.now() });
        }}
        className="relative -ml-1 shrink-0 overflow-hidden rounded-ns px-2 py-1 font-ui text-[11px] font-semibold text-ns-ink-muted transition-colors hover:bg-ns-surface-hover hover:text-ns-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ns-ink-muted motion-reduce:transition-none"
      >
        {ripple > 0 ? (
          <span
            key={ripple}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-ns bg-ns-accent-subtle animate-ns-ink-spread motion-reduce:animate-none"
          />
        ) : null}
        <span className="relative flex items-center gap-1.5">
          <PenLine className="h-3 w-3" />
          New chat
        </span>
      </button>
      <span className="min-w-0 truncate font-ui text-[10px] text-ns-ink-muted">
        {label}
      </span>
    </div>
  );
}
