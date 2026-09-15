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
  WandSparkles,
  WifiOff,
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
  useSyncExternalStore,
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
import { HELP_COMMAND } from "./slashCommands";
import {
  proposeEditorEditSchema,
  type Capability,
  type ProposeEditorEditArgs,
} from "@novelsync/assistant-contracts";
import {
  useEditorBridge,
  useEditorBridgeSnapshot,
  type ProposalCheck,
} from "@/components/editor/EditorBridge";
import {
  EditorActionLedger,
  type EditorActionState,
} from "./editorActionLedger";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { toast } from "sonner";
import { AssistantThreadSession } from "./assistantHistory";

const READ_TOOL_NAMES = [
  "get_story_overview",
  "list_story_entities",
  "get_story_entity",
  "search_story",
  "read_chapter",
  "read_current_editor",
] as const;
const EDITOR_ACTIONS_PRESENTED =
  import.meta.env.VITE_ASSISTANT_EDITOR_ACTIONS_ENABLED !== "false";

const AssistantPanelContext = createContext<{
  storyId: string;
  navigateTo: (to: string, state?: { assistantChapterId: string }) => void;
  actionLedger: EditorActionLedger;
} | null>(null);

const noopSubscribe = () => () => undefined;
const zeroVersion = () => 0;

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

const proposalProblem: Record<
  Exclude<ProposalCheck, { ok: true }>["reason"],
  string
> = {
  no_editor: "Open the matching chapter in the editor to review this change.",
  wrong_story: "This suggestion belongs to another story.",
  wrong_chapter:
    "The active chapter changed. Return to the original chapter to review it.",
  stale_revision:
    "The saved chapter changed after this suggestion was drafted.",
  stale_document: "The editor changed after this suggestion was drafted.",
  unsupported_operation:
    "This suggestion uses an edit shape the editor does not support.",
  invalid_range: "The suggested text range is no longer valid.",
  changed_text: "The selected words changed after this suggestion was drafted.",
  unsupported_selection:
    "This selection crosses a block or includes unsupported content.",
  unsupported_replacement:
    "This first edit release supports one plain-text paragraph at a time.",
};

function useEditorAction(
  ledger: EditorActionLedger | undefined,
  approvalId: string | undefined,
): EditorActionState {
  useSyncExternalStore(
    ledger?.subscribe ?? noopSubscribe,
    ledger?.getVersion ?? zeroVersion,
    ledger?.getVersion ?? zeroVersion,
  );
  return ledger && approvalId ? ledger.get(approvalId) : { status: "idle" };
}

function ProposeEditorEditCard({ status }: ToolCallMessagePartProps) {
  return (
    <div className="my-2 flex items-center gap-2 rounded-ns border border-ns-gold/30 bg-amber-500/5 px-3 py-2 font-ui text-[11px] text-ns-ink-secondary">
      {status.type === "running" ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-ns-gold" />
      ) : (
        <WandSparkles className="h-3.5 w-3.5 text-ns-gold" />
      )}
      {status.type === "running"
        ? "Drafting a selection-only revision…"
        : "Revision drafted for review"}
    </div>
  );
}

function ApplyEditorEditCard({
  args,
  approval,
  respondToApproval,
}: ToolCallMessagePartProps) {
  const context = useContext(AssistantPanelContext);
  const bridge = useEditorBridge();
  const editorSnapshot = useEditorBridgeSnapshot();
  const { isOnline } = useNetworkStatus();
  const messageContent = useAuiState((state) => state.message.content);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const approvalId = approval?.id;
  const action = useEditorAction(context?.actionLedger, approvalId);
  const proposalId = objectValue(args)?.proposalId;
  const proposalPart = [...messageContent].reverse().find((part) => {
    if (part.type !== "tool-call" || part.toolName !== "propose_editor_edit") {
      return false;
    }
    return objectValue(part.result)?.proposalId === proposalId;
  });
  const parsedProposal = proposeEditorEditSchema.safeParse(
    proposalPart?.type === "tool-call" ? proposalPart.args : null,
  );
  const proposal: ProposeEditorEditArgs | null = parsedProposal.success
    ? parsedProposal.data
    : null;
  const operation =
    proposal?.operations.length === 1 &&
    proposal.operations[0]?.type === "replace"
      ? proposal.operations[0]
      : null;
  const proposalCheck = proposal
    ? (bridge?.inspectProposal(proposal) ?? {
        ok: false as const,
        reason: "no_editor" as const,
      })
    : ({
        ok: false as const,
        reason: "unsupported_operation" as const,
      } satisfies ProposalCheck);
  const resolved =
    approval?.approved !== undefined || action.status === "resolved";
  const busy = action.status === "applying";
  const canApply =
    Boolean(approvalId && proposal && operation && proposalCheck.ok) &&
    !resolved &&
    !busy &&
    isOnline;

  const resolveDecision = async (
    decision: "rejected" | "revision_requested",
    revisionFeedback?: string,
  ) => {
    if (!context || !approvalId || resolved || busy) return;
    context.actionLedger.resolve(approvalId, {
      decision,
      feedback: revisionFeedback,
    });
    try {
      await respondToApproval({
        approved: false,
        reason: decision,
      });
    } catch {
      context.actionLedger.reset(approvalId);
      toast.error("The decision could not be recorded. Please try again.");
    }
  };

  const apply = async () => {
    if (!context || !bridge || !approvalId || !proposal || !canApply) return;
    if (!context.actionLedger.beginApply(approvalId)) return;
    const result = await bridge.applyProposal(proposal);
    context.actionLedger.resolve(approvalId, {
      decision: result.status === "saved" ? "applied" : "apply_failed",
      result,
    });
    try {
      await respondToApproval({ approved: true, reason: "editor_action" });
    } catch {
      context.actionLedger.reset(approvalId);
      toast.error(
        result.status === "saved"
          ? "The edit was saved, but the assistant could not acknowledge it."
          : "The assistant could not record the save result.",
      );
    }
  };

  const copyReplacement = async () => {
    if (!operation) return;
    try {
      await navigator.clipboard.writeText(operation.replacementText);
      toast.success("Replacement copied.");
    } catch {
      toast.error("Couldn't copy the replacement.");
    }
  };

  const submitRevision = async () => {
    const bounded = feedback.trim().slice(0, 500);
    if (!bounded) return;
    await resolveDecision("revision_requested", bounded);
  };

  const terminalMessage =
    action.status !== "resolved"
      ? null
      : action.decision === "applied"
        ? "Applied and saved. Undo remains available in the editor."
        : action.decision === "apply_failed"
          ? action.result?.status === "applied_local_save_conflict"
            ? "Applied locally, but the saved chapter changed elsewhere. Your local edit was kept."
            : action.result?.status === "stale" ||
                action.result?.status === "invalid"
              ? "The suggestion became stale before it could be applied."
              : "Applied locally, but it could not be saved. Your local edit was kept."
          : action.decision === "revision_requested"
            ? "Revision notes sent."
            : "Suggestion rejected. No text changed.";

  return (
    <section
      className="my-3 overflow-hidden rounded-[0.9rem] border border-ns-gold/35 bg-ns-elevated shadow-ns"
      data-cy="assistant-edit-review"
      aria-label="Review editor suggestion"
    >
      <header className="border-b border-ns-gold/25 bg-[linear-gradient(120deg,var(--ns-accent-subtle),transparent_70%)] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ns-gold/30 bg-ns-bg text-ns-gold shadow-ns-sm">
            <WandSparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-gold">
              Manuscript suggestion
            </p>
            <h4 className="mt-0.5 font-heading text-base font-semibold leading-5 text-ns-ink">
              {proposal?.summary ?? "Review unavailable"}
            </h4>
            <p className="mt-1 truncate font-ui text-[10px] text-ns-ink-muted">
              {bridge?.getActiveChapterTitle() ?? "Current chapter"} · one
              selection
            </p>
          </div>
        </div>
      </header>

      {operation ? (
        <div className="grid border-b border-ns-border sm:grid-cols-2">
          <div className="border-b border-ns-border bg-red-500/[0.035] p-3 sm:border-b-0 sm:border-r">
            <p className="font-ui text-[9px] font-bold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">
              Before · {operation.originalText.length} chars
            </p>
            <p className="mt-2 whitespace-pre-wrap font-heading text-sm leading-6 text-ns-ink-secondary line-through decoration-red-500/60">
              {operation.originalText}
            </p>
          </div>
          <div className="bg-emerald-500/[0.035] p-3">
            <p className="font-ui text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              After · {operation.replacementText.length} chars
            </p>
            <p className="mt-2 whitespace-pre-wrap font-heading text-sm leading-6 text-ns-ink">
              {operation.replacementText || (
                <span className="italic text-ns-ink-muted">
                  Delete selection
                </span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <p className="border-b border-ns-border px-4 py-3 font-ui text-xs text-ns-destructive">
          The proposal payload could not be matched safely.
        </p>
      )}

      <div className="space-y-3 px-4 py-3">
        {!proposalCheck.ok && !terminalMessage && (
          <p
            role="status"
            className="font-ui text-xs leading-5 text-amber-700 dark:text-amber-300"
          >
            {proposalProblem[proposalCheck.reason]}
          </p>
        )}
        {!isOnline && !terminalMessage && (
          <p className="flex items-center gap-1.5 font-ui text-xs text-amber-700 dark:text-amber-300">
            <WifiOff className="h-3.5 w-3.5" /> Reconnect before applying so the
            edit can be saved.
          </p>
        )}
        {terminalMessage && (
          <p
            role="status"
            className="rounded-ns bg-ns-surface px-3 py-2 font-ui text-xs leading-5 text-ns-ink-secondary"
          >
            {terminalMessage}
          </p>
        )}

        {showFeedback && !resolved && (
          <div className="space-y-2">
            <label className="block font-ui text-[10px] font-semibold uppercase tracking-wide text-ns-ink-secondary">
              Revision note
              <textarea
                value={feedback}
                maxLength={500}
                autoFocus
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="What should change in the next version?"
                className="mt-1.5 min-h-20 w-full resize-y rounded-ns border border-ns-border-strong bg-ns-bg p-2.5 text-xs font-normal normal-case tracking-normal text-ns-ink outline-none focus:border-ns-accent focus:ring-2 focus:ring-[var(--ns-ring)]"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFeedback(false)}
                className="rounded-ns px-2.5 py-1.5 font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!feedback.trim()}
                onClick={() => void submitRevision()}
                className="rounded-ns bg-ns-ink px-2.5 py-1.5 font-ui text-xs font-semibold text-ns-bg disabled:opacity-40"
              >
                Send note
              </button>
            </div>
          </div>
        )}

        {!showFeedback && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-cy="assistant-edit-apply"
              disabled={!canApply}
              onClick={() => void apply()}
              className="inline-flex items-center gap-1.5 rounded-ns bg-ns-accent px-3 py-2 font-ui text-xs font-semibold text-white shadow-ns-sm hover:bg-ns-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {busy ? "Applying…" : "Apply & save"}
            </button>
            <button
              type="button"
              disabled={resolved || busy}
              onClick={() => void resolveDecision("rejected")}
              className="rounded-ns border border-ns-border-strong px-3 py-2 font-ui text-xs font-semibold text-ns-ink-secondary hover:bg-ns-surface-hover disabled:opacity-40"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={resolved || busy}
              onClick={() => setShowFeedback(true)}
              className="rounded-ns px-2 py-2 font-ui text-xs text-ns-accent hover:bg-ns-accent-subtle disabled:opacity-40"
            >
              Ask for revision
            </button>
            <button
              type="button"
              disabled={!operation}
              onClick={() => void copyReplacement()}
              className="ml-auto inline-flex items-center gap-1 rounded-ns px-2 py-2 font-ui text-xs text-ns-ink-muted hover:bg-ns-surface-hover"
              aria-label="Copy replacement text"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        )}
        <span className="sr-only" aria-live="polite">
          {editorSnapshot?.chapterId ? terminalMessage : null}
        </span>
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

function AssistantConnectionError() {
  const hasStructuredFailure = useAuiState(
    (state) =>
      state.message.role === "assistant" &&
      Boolean(
        (
          state.message.metadata.custom?.novelsync as
            AssistantMessageMetadata | undefined
        )?.failure,
      ),
  );
  if (hasStructuredFailure) return null;

  return (
    <div role="alert" className="mt-2 text-xs text-ns-destructive">
      The assistant connection failed safely. Please retry.
    </div>
  );
}

function AssistantWorkingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-cy="assistant-working"
      className="relative mt-2 overflow-hidden rounded-ns-lg border border-ns-gold/25 bg-ns-surface/80 px-4 py-3 shadow-ns-sm"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-ns-gold/70 to-transparent motion-reduce:animate-none"
      />
      <div className="flex items-center gap-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ns-gold/30 bg-ns-elevated text-ns-gold shadow-ns-sm">
          <span className="absolute inset-1 animate-ping rounded-full border border-ns-gold/20 motion-reduce:animate-none" />
          <Sparkles className="relative h-4 w-4 animate-pulse motion-reduce:animate-none" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold text-ns-ink">
            Gathering the threads
          </p>
          <p className="mt-0.5 font-ui text-[11px] leading-4 text-ns-ink-secondary">
            Reading your story and shaping a careful response…
          </p>
        </div>
        <span className="flex shrink-0 items-end gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-ns-gold motion-reduce:animate-none" />
          <span className="h-2.5 w-1.5 animate-[pulse_1.2s_ease-in-out_0.2s_infinite] rounded-full bg-ns-accent/70 motion-reduce:animate-none" />
          <span className="h-4 w-1.5 animate-[pulse_1.2s_ease-in-out_0.4s_infinite] rounded-full bg-ns-gold motion-reduce:animate-none" />
        </span>
      </div>
    </div>
  );
}

/**
 * The answer to `/help`, rendered from the catalog the agents repository
 * generates. It reuses the icon each tool already carries in `toolDetails` so
 * a capability here and the same tool in a transcript read as one thing.
 */
const CAPABILITY_ICONS: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  story_overview: Library,
  list_entities: Users,
  entity_detail: FileSearch,
  search_story: Search,
  read_chapter: BookOpen,
  read_current_editor: ListTree,
  propose_edit: WandSparkles,
  research_web: ExternalLink,
};

function CapabilityRow({ capability }: { capability: Capability }) {
  const Icon = CAPABILITY_ICONS[capability.id] ?? MessageCircle;
  return (
    <li className="rounded-ns-lg border border-ns-border bg-ns-elevated p-3 shadow-ns-sm">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ns-border bg-ns-surface text-ns-accent">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold text-ns-ink">
            {capability.title}
          </p>
          <p className="mt-0.5 text-[13px] leading-5 text-ns-ink-secondary">
            {capability.summary}
          </p>
          {capability.limits && (
            <p className="mt-1 font-ui text-[11px] leading-4 text-ns-ink-muted">
              {capability.limits}
            </p>
          )}
          <ThreadPrimitive.Suggestion
            prompt={capability.example}
            send
            className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-ns-border bg-ns-surface px-2.5 py-1 text-left font-ui text-[11px] leading-4 text-ns-ink-secondary transition-colors hover:border-ns-border-strong hover:text-ns-ink"
          >
            <Sparkles className="h-3 w-3 shrink-0 text-ns-accent" aria-hidden />
            <span className="truncate">{capability.example}</span>
          </ThreadPrimitive.Suggestion>
        </div>
      </div>
    </li>
  );
}

function HelpCard({
  help,
}: {
  help: NonNullable<AssistantMessageMetadata["help"]>;
}) {
  return (
    <section data-cy="assistant-help" className="mt-1">
      <p className="text-[15px] leading-7 text-ns-ink">{help.preamble}</p>
      <ul className="mt-3 grid gap-2">
        {help.capabilities.map((capability) => (
          <CapabilityRow key={capability.id} capability={capability} />
        ))}
      </ul>
      <ul className="mt-3 space-y-1 border-t border-ns-border pt-2.5 font-ui text-[11px] leading-4 text-ns-ink-muted">
        {help.boundaries.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function AssistantMessage() {
  const role = useAuiState((state) => state.message.role);
  const waitingForFirstPart = useAuiState(
    (state) =>
      state.message.status?.type === "running" &&
      state.message.content.length === 0,
  );
  const help = useAuiState((state) =>
    state.message.role === "assistant"
      ? ((
          state.message.metadata.custom?.novelsync as
            AssistantMessageMetadata | undefined
        )?.help ?? null)
      : null,
  );
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
        {isAssistant && waitingForFirstPart && <AssistantWorkingState />}
        {/* The text part stays in the message so copy and assistive tech still
            reach it; only the rendering is replaced. */}
        {help ? (
          <HelpCard help={help} />
        ) : (
          <MessagePrimitive.Parts
            components={{
              Text: PlainTextPart,
              Source: StorySource,
              tools: {
                by_name: {
                  ...Object.fromEntries(
                    READ_TOOL_NAMES.map((name) => [name, ReadToolCard]),
                  ),
                  propose_editor_edit: ProposeEditorEditCard,
                  apply_editor_edit: ApplyEditorEditCard,
                },
                Fallback: ReadToolCard,
              },
            }}
          />
        )}
        {isAssistant && <MessageMetadata />}
        <MessagePrimitive.Error>
          <AssistantConnectionError />
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
  const suggestions: readonly (readonly [string, string])[] = [
    // First, because everything below is an example of one thing this answers.
    ["What can you do?", HELP_COMMAND],
    ["Outline check", "Give me an overview of this story and its chapters."],
    ["Cast list", "List the characters in this story."],
    [
      "Find a thread",
      "Search the story for the protagonist’s central conflict.",
    ],
    ...(EDITOR_ACTIONS_PRESENTED
      ? [
          [
            "Polish selection",
            "Suggest a tighter revision for the text I selected in the editor.",
          ] as const,
        ]
      : []),
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
          {EDITOR_ACTIONS_PRESENTED
            ? " Selected text can be revised only after you review and apply it."
            : " This assistant can read, never edit."}
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
            Enter to send · Shift+Enter for a new line · {HELP_COMMAND} for what
            I can do
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
        Current story only · Conversation saved
      </p>
    </div>
  );
}

export default function AssistantPanel({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const editorBridge = useEditorBridge();
  const [actionLedger] = useState(() => new EditorActionLedger());
  const navigate = useNavigate();
  const threadSession = useMemo(
    () => new AssistantThreadSession(storyId),
    [storyId],
  );
  const history = useMemo(() => threadSession.history(), [threadSession]);
  const endpoint =
    import.meta.env.VITE_ASSISTANT_RUN_FIREBASE === "true"
      ? getFunctionUrl("assistantRun")
      : "/assistant-run/assistantRun";
  const adapter = useMemo(
    () =>
      createAssistantAdapter({
        storyId,
        activeRequest,
        actionLedger,
        editsEnabled: EDITOR_ACTIONS_PRESENTED,
        transport: {
          endpoint,
          getIdToken: async () => auth.currentUser?.getIdToken() ?? null,
          getThreadId: () => threadSession.threadId(),
          prepareEditorContext: async (mode) =>
            mode === "send"
              ? (editorBridge?.prepareSnapshot() ?? null)
              : (editorBridge?.getSnapshot() ?? null),
        },
      }),
    [actionLedger, editorBridge, endpoint, storyId, threadSession],
  );
  const runtime = useLocalRuntime(adapter, { adapters: { history } });

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
        actionLedger.clear();
        setOpen(false);
      }),
    [actionLedger, runtime],
  );

  const navigateTo = useCallback(
    (to: string, state?: { assistantChapterId: string }) => {
      changeOpen(false);
      navigate(to, state ? { state } : undefined);
    },
    [changeOpen, navigate],
  );
  const panelContext = useMemo(
    () => ({ storyId, navigateTo, actionLedger }),
    [actionLedger, navigateTo, storyId],
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
                      {EDITOR_ACTIONS_PRESENTED
                        ? "Reads your story · changes selected text only with approval"
                        : "A read-only companion for this story workspace"}
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
