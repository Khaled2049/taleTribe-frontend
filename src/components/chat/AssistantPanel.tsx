import * as Dialog from "@radix-ui/react-dialog";
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  type SourceMessagePartProps,
  type TextMessagePartProps,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { auth } from "@novelsync/platform-auth";
import {
  ArrowDown,
  BookOpen,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  FileSearch,
  Library,
  ListTree,
  LoaderCircle,
  MapPin,
  MessageCircle,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
  Users,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useNavigate } from "react-router-dom";
import { getFunctionUrl } from "@/cloudFunctions";
import {
  safeWebReferenceUrl,
  toolNavigationTarget,
} from "./assistantNavigation";
import { createAssistantAdapter } from "./assistantRuntime";
import type { AssistantMessageMetadata } from "./assistantRunModel";

const READ_TOOL_NAMES = [
  "get_story_overview",
  "list_story_entities",
  "get_story_entity",
  "search_story",
  "read_chapter",
  "read_current_editor",
] as const;

const AssistantPanelContext = createContext<{
  storyId: string;
  navigateTo: (to: string, state?: { assistantChapterId: string }) => void;
} | null>(null);

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resultItems(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const record = objectValue(result);
  if (Array.isArray(record?.entities)) return record.entities;
  if (Array.isArray(record?.results)) return record.results;
  return [];
}

function toolDetails(
  toolName: string,
  args: unknown,
  result: unknown,
): {
  title: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
} {
  const argRecord = objectValue(args);
  const resultRecord = objectValue(result);
  switch (toolName) {
    case "get_story_overview":
      return {
        title: "Story overview",
        detail:
          typeof resultRecord?.chapter_count === "number"
            ? `${resultRecord.chapter_count} chapters reviewed`
            : "Reading story structure",
        icon: Library,
      };
    case "list_story_entities": {
      const kind = String(
        argRecord?.kind ?? resultRecord?.kind ?? "story details",
      );
      const count = resultItems(result).length;
      return {
        title: `Story ${kind}s`,
        detail: count
          ? `${count} ${count === 1 ? "entry" : "entries"} found`
          : `Reading ${kind}s`,
        icon:
          kind === "character" ? Users : kind === "place" ? MapPin : ListTree,
      };
    }
    case "get_story_entity":
      return {
        title: "Story detail",
        detail: String(
          resultRecord?.name ?? argRecord?.kind ?? "Reading canonical data",
        ),
        icon: FileSearch,
      };
    case "search_story": {
      const count = resultItems(result).length;
      return {
        title: "Story search",
        detail:
          typeof argRecord?.query === "string"
            ? `${count ? `${count} matches for` : "Searching for"} “${argRecord.query}”`
            : "Searching story passages",
        icon: Search,
      };
    }
    case "read_chapter":
      return {
        title: "Chapter reading",
        detail: String(resultRecord?.title ?? "Reading a chapter passage"),
        icon: BookOpen,
      };
    case "read_current_editor":
      return {
        title: "Current editor",
        detail:
          resultRecord?.available === false
            ? "No editor selection was shared"
            : "Checking the available editor selection",
        icon: FileSearch,
      };
    default:
      return {
        title: "Story read",
        detail: "The assistant used a read-only story tool",
        icon: FileSearch,
      };
  }
}

function ReadToolCard({
  toolName,
  args,
  result,
  isError,
  status,
}: ToolCallMessagePartProps) {
  const context = useContext(AssistantPanelContext);
  const { title, detail, icon: Icon } = toolDetails(toolName, args, result);
  const resultRecord = objectValue(result);
  const items = resultItems(result);
  const stale = items.some((item) => objectValue(item)?.stale === true);
  const truncated =
    resultRecord?.truncated === true ||
    resultRecord?.chapters_truncated === true ||
    items.some((item) => objectValue(item)?.truncated === true);
  const running = status.type === "running";
  const target = context
    ? toolNavigationTarget(context.storyId, toolName, args, result)
    : null;

  return (
    <section
      className="my-2 overflow-hidden rounded-ns-lg border border-ns-border bg-ns-surface/80 font-ui shadow-ns-sm"
      data-cy={`assistant-tool-${toolName}`}
      aria-label={`${title}: ${running ? "running" : isError ? "failed" : "complete"}`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ns-elevated text-ns-accent shadow-ns-sm">
          {running ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
          ) : isError ? (
            <CircleAlert className="h-3.5 w-3.5 text-ns-destructive" />
          ) : (
            <Icon className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-semibold text-ns-ink">
              {title}
            </p>
            {!running && !isError && (
              <Check className="h-3 w-3 text-ns-success" aria-hidden />
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-ns-ink-secondary">
            {isError
              ? String(
                  resultRecord?.message ??
                    "This story read could not be completed.",
                )
              : detail}
          </p>
          {(stale || truncated) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stale && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  Indexed copy may be stale
                </span>
              )}
              {truncated && (
                <span className="rounded-full border border-ns-border-strong bg-ns-elevated px-2 py-0.5 text-[10px] font-semibold text-ns-ink-secondary">
                  Partial result
                </span>
              )}
            </div>
          )}
        </div>
        {target && !running && !isError && (
          <button
            type="button"
            className="shrink-0 rounded-ns px-2 py-1 text-[10px] font-semibold text-ns-accent hover:bg-ns-accent-subtle"
            onClick={() => context?.navigateTo(target.to, target.state)}
          >
            {target.label}
          </button>
        )}
      </div>
    </section>
  );
}

function PlainTextPart({ text }: TextMessagePartProps) {
  const role = useAuiState((state) => state.message.role);
  return (
    <p
      className={`whitespace-pre-wrap ${
        role === "user"
          ? "font-ui text-sm leading-6 text-ns-bg"
          : "text-[15px] leading-7 text-ns-ink"
      }`}
    >
      {text}
    </p>
  );
}

function StorySource({ title, providerMetadata }: SourceMessagePartProps) {
  const meta = objectValue(providerMetadata?.novelsync);
  const url = safeWebReferenceUrl(meta?.kind, meta?.url);
  const snippet = typeof meta?.snippet === "string" ? meta.snippet : null;
  const chip = (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-ns-border bg-ns-elevated px-2.5 py-1 font-ui text-[10px] font-semibold text-ns-ink-secondary shadow-ns-sm"
      title={snippet ?? title}
    >
      <BookOpen className="h-3 w-3 shrink-0 text-ns-accent" aria-hidden />
      <span className="truncate">{title}</span>
      {url && <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />}
    </span>
  );
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="no-underline">
      {chip}
    </a>
  ) : (
    chip
  );
}

function MessageMetadata() {
  const metadata = useAuiState((state) =>
    state.message.role === "assistant"
      ? (state.message.metadata.custom?.novelsync as
          AssistantMessageMetadata | undefined)
      : undefined,
  );
  const messageStatus = useAuiState((state) => state.message.status);
  if (!metadata) return null;
  const usage = metadata.usage;
  const tokens = usage.promptTokens + usage.completionTokens;
  const cancelled =
    messageStatus?.type === "incomplete"
      ? messageStatus.reason === "cancelled"
      : false;
  const notice = cancelled
    ? "Stopped. The partial response above was kept."
    : metadata.notice;
  const noticeReason = cancelled ? "run.cancelled" : metadata.finishReason;

  return (
    <div
      className="mt-3 space-y-2 font-ui"
      data-cy="assistant-metadata"
      data-run-id={metadata.runId ?? undefined}
    >
      {metadata.failure && (
        <div
          role="alert"
          className="rounded-ns border border-ns-destructive/25 bg-ns-accent-subtle px-3 py-2 text-xs leading-5 text-ns-ink-secondary"
          data-cy={`assistant-error-${metadata.failure.code}`}
        >
          <span className="font-semibold text-ns-ink">
            Couldn’t finish this response.{" "}
          </span>
          {metadata.failure.message}
        </div>
      )}
      {notice && (
        <div
          className="rounded-ns border border-ns-gold/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-ns-ink-secondary"
          data-cy={`assistant-notice-${noticeReason}`}
        >
          {notice}
        </div>
      )}
      {usage.modelCalls > 0 && (
        <p
          className="text-[10px] tracking-wide text-ns-ink-muted"
          data-cy="assistant-usage"
        >
          This response · {tokens.toLocaleString()} tokens ·{" "}
          {usage.credits.toLocaleString()} credits
          {usage.modelCalls > 1 ? ` · ${usage.modelCalls} model calls` : ""}
        </p>
      )}
    </div>
  );
}

function AssistantMessage() {
  const role = useAuiState((state) => state.message.role);
  const isAssistant = role === "assistant";
  return (
    <MessagePrimitive.Root
      className={`group mx-auto w-full max-w-2xl px-4 py-3 ${isAssistant ? "" : "flex justify-end"}`}
      data-cy={isAssistant ? "assistant-message" : "assistant-user-message"}
    >
      <div
        className={
          isAssistant
            ? "max-w-full"
            : "max-w-[85%] rounded-[1.15rem_1.15rem_0.3rem_1.15rem] bg-ns-ink px-4 py-2.5 font-ui text-sm leading-6 text-ns-bg shadow-ns-sm"
        }
      >
        {isAssistant && (
          <div className="mb-2 flex items-center gap-2 font-ui text-[10px] font-semibold uppercase tracking-[0.13em] text-ns-ink-muted">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ns-accent text-white">
              <Sparkles className="h-3 w-3" aria-hidden />
            </span>
            Story assistant
          </div>
        )}
        <MessagePrimitive.Parts
          components={{
            Text: PlainTextPart,
            Source: StorySource,
            tools: {
              by_name: Object.fromEntries(
                READ_TOOL_NAMES.map((name) => [name, ReadToolCard]),
              ),
              Fallback: ReadToolCard,
            },
          }}
        />
        {isAssistant && <MessageMetadata />}
        <MessagePrimitive.Error>
          <div role="alert" className="mt-2 text-xs text-ns-destructive">
            The assistant connection failed safely. Please retry.
          </div>
        </MessagePrimitive.Error>
        {isAssistant && (
          <ActionBarPrimitive.Root
            hideWhenRunning
            className="mt-2 flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100"
          >
            <ActionBarPrimitive.Copy
              aria-label="Copy response"
              title="Copy response"
              className="rounded-ns p-1.5 text-ns-ink-muted hover:bg-ns-surface-hover hover:text-ns-ink"
            >
              <Copy className="h-3.5 w-3.5" />
            </ActionBarPrimitive.Copy>
            <ActionBarPrimitive.Reload
              aria-label="Retry response"
              title="Retry response"
              data-cy="assistant-retry"
              className="rounded-ns p-1.5 text-ns-ink-muted hover:bg-ns-surface-hover hover:text-ns-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </ActionBarPrimitive.Reload>
          </ActionBarPrimitive.Root>
        )}
      </div>
    </MessagePrimitive.Root>
  );
}

function EmptyAssistant() {
  const suggestions = [
    ["Outline check", "Give me an overview of this story and its chapters."],
    ["Cast list", "List the characters in this story."],
    [
      "Find a thread",
      "Search the story for the protagonist’s central conflict.",
    ],
  ] as const;
  return (
    <ThreadPrimitive.Empty>
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-12 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-ns-border bg-ns-elevated text-ns-accent shadow-ns">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="font-heading text-2xl font-medium text-ns-ink">
          Read between the lines
        </h3>
        <p className="mt-2 text-sm leading-6 text-ns-ink-secondary">
          Ask about the story’s chapters, characters, places, plot, or passages.
          This assistant can read, never edit.
        </p>
        <div className="mt-7 grid gap-2 text-left">
          {suggestions.map(([label, prompt]) => (
            <ThreadPrimitive.Suggestion
              key={label}
              prompt={prompt}
              send
              className="group rounded-ns-lg border border-ns-border bg-ns-elevated px-3.5 py-3 text-left shadow-ns-sm transition-all hover:-translate-y-0.5 hover:border-ns-border-strong hover:shadow-ns motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span className="block font-ui text-[10px] font-semibold uppercase tracking-[0.12em] text-ns-accent">
                {label}
              </span>
              <span className="mt-1 block text-sm leading-5 text-ns-ink-secondary">
                {prompt}
              </span>
            </ThreadPrimitive.Suggestion>
          ))}
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
}

function Composer() {
  return (
    <div className="border-t border-ns-border bg-ns-elevated/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <ComposerPrimitive.Root className="rounded-ns-xl border border-ns-border-strong bg-ns-bg p-2 shadow-ns-sm focus-within:border-ns-accent focus-within:ring-2 focus-within:ring-[var(--ns-ring)]">
        <ComposerPrimitive.Input
          autoFocus
          aria-label="Ask about this story"
          data-cy="assistant-input"
          placeholder="Ask about this story…"
          rows={1}
          maxRows={5}
          className="block max-h-32 min-h-11 w-full resize-none bg-transparent px-2 py-2 font-ui text-sm leading-6 text-ns-ink outline-none placeholder:text-ns-ink-muted"
        />
        <div className="flex items-center justify-between gap-3 px-1 pb-0.5">
          <p className="font-ui text-[10px] text-ns-ink-muted">
            Enter to send · Shift+Enter for a new line
          </p>
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send
              aria-label="Send message"
              data-cy="assistant-send"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-ns-accent text-white shadow-ns-sm transition-transform hover:bg-ns-accent-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              <Send className="h-3.5 w-3.5" />
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>
          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel
              aria-label="Stop response"
              data-cy="assistant-stop"
              className="flex h-8 items-center gap-1.5 rounded-full bg-ns-ink px-3 font-ui text-[11px] font-semibold text-ns-bg"
            >
              <Square className="h-3 w-3 fill-current" />
              Stop
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </div>
      </ComposerPrimitive.Root>
      <p className="mt-2 text-center font-ui text-[9px] tracking-wide text-ns-ink-muted">
        Current story only · Conversation isn’t saved
      </p>
    </div>
  );
}

export default function AssistantPanel({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const endpoint =
    import.meta.env.VITE_ASSISTANT_RUN_FIREBASE === "true"
      ? getFunctionUrl("assistantRun")
      : "/assistant-run/assistantRun";
  const adapter = useMemo(
    () =>
      createAssistantAdapter({
        storyId,
        activeRequest,
        transport: {
          endpoint,
          getIdToken: async () => auth.currentUser?.getIdToken() ?? null,
        },
      }),
    [endpoint, storyId],
  );
  const runtime = useLocalRuntime(adapter);

  const stopRun = useCallback(() => {
    activeRequest.current?.abort();
    runtime.thread.cancelRun();
  }, [runtime]);

  const changeOpen = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) stopRun();
      setOpen(nextOpen);
    },
    [stopRun],
  );

  useEffect(
    () => () => {
      activeRequest.current?.abort();
      runtime.thread.cancelRun();
    },
    [runtime],
  );

  useEffect(
    () =>
      auth.onAuthStateChanged((user) => {
        if (user) return;
        activeRequest.current?.abort();
        runtime.thread.cancelRun();
        runtime.thread.reset();
        setOpen(false);
      }),
    [runtime],
  );

  const navigateTo = useCallback(
    (to: string, state?: { assistantChapterId: string }) => {
      changeOpen(false);
      navigate(to, state ? { state } : undefined);
    },
    [changeOpen, navigate],
  );
  const panelContext = useMemo(
    () => ({ storyId, navigateTo }),
    [navigateTo, storyId],
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantPanelContext.Provider value={panelContext}>
        <Dialog.Root open={open} onOpenChange={changeOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              data-cy="open-chat"
              className="fixed bottom-24 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-ns-accent text-white shadow-ns-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-ns-accent-hover active:scale-95 motion-reduce:transform-none motion-reduce:transition-none md:right-6"
              aria-label="Open story assistant"
              title="Story assistant"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
            <Dialog.Content
              data-cy="assistant-panel"
              aria-describedby="assistant-panel-description"
              className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-ns-bg text-ns-ink shadow-ns-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right motion-reduce:animate-none md:inset-y-0 md:left-auto md:right-0 md:w-[29rem] md:border-l md:border-ns-border"
            >
              <header className="relative shrink-0 overflow-hidden border-b border-ns-border bg-ns-surface px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))]">
                <div className="pointer-events-none absolute -right-12 -top-16 h-32 w-32 rounded-full bg-ns-accent-subtle blur-2xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ns-accent text-white shadow-ns-sm">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                      <Dialog.Title className="font-heading text-xl font-semibold text-ns-ink">
                        Story assistant
                      </Dialog.Title>
                    </div>
                    <Dialog.Description
                      id="assistant-panel-description"
                      className="mt-1.5 font-ui text-[11px] leading-4 text-ns-ink-muted"
                    >
                      A read-only companion for this story workspace
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close story assistant"
                      data-cy="assistant-close"
                      className="rounded-full border border-ns-border bg-ns-elevated p-2 text-ns-ink-muted shadow-ns-sm transition-colors hover:bg-ns-surface-hover hover:text-ns-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>
              </header>

              <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
                <ThreadPrimitive.Viewport className="relative flex-1 overflow-y-auto scroll-smooth bg-[radial-gradient(circle_at_top_right,var(--ns-accent-subtle),transparent_34%)] motion-reduce:scroll-auto">
                  <EmptyAssistant />
                  <ThreadPrimitive.Messages
                    components={{ Message: AssistantMessage }}
                  />
                  <ThreadPrimitive.ViewportFooter className="sticky bottom-3 flex justify-center">
                    <ThreadPrimitive.ScrollToBottom
                      aria-label="Scroll to latest message"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-ns-border bg-ns-elevated text-ns-ink-secondary shadow-ns transition-colors hover:text-ns-accent"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </ThreadPrimitive.ScrollToBottom>
                  </ThreadPrimitive.ViewportFooter>
                </ThreadPrimitive.Viewport>
                <Composer />
              </ThreadPrimitive.Root>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </AssistantPanelContext.Provider>
    </AssistantRuntimeProvider>
  );
}
