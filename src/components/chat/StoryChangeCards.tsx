import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  useAuiState,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, Sparkles, WifiOff } from "lucide-react";
import { toast } from "sonner";
import {
  proposeStoryChangesSchema,
  type ProposeStoryChangesArgs,
  type StoryChange,
  type StoryChangeFields,
} from "@novelsync/assistant-contracts";
import { storyWorldbuildingRepo } from "@novelsync/story-data-client";
import { useCharacters } from "@/hooks/queries/useCharacterQueries";
import { usePlaces } from "@/hooks/queries/usePlaceQueries";
import { usePlots } from "@/hooks/queries/usePlotQueries";
import { queryKeys } from "@/hooks/queries/queryKeys";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import type {
  EditorActionLedger,
  EditorActionState,
} from "./editorActionLedger";
import {
  allApplied,
  applyStoryChanges,
  changeKind,
  currentTarget,
  isCreate,
  isStale,
  type StorySnapshot,
} from "./storyChangeApply";
import { objectValue, proposalArgs } from "./toolParts";

const noopSubscribe = () => () => undefined;
const zeroVersion = () => 0;

const KIND_LABEL = {
  character: "character",
  place: "place",
  plot: "plot line",
  event: "plot event",
} as const;

const FIELD_LABEL: Record<keyof StoryChangeFields, string> = {
  name: "Name",
  age: "Age",
  soul: "Soul",
  personality: "Personality",
  voice: "Voice",
  backstory: "Backstory",
  affiliations: "Affiliations",
  description: "Description",
  atmosphere: "Atmosphere",
  geography: "Geography",
  history: "History",
  significance: "Significance",
  content: "What happens",
  tensionLevel: "Tension",
  pacing: "Pacing",
  storyBeat: "Story beat",
  emotionalTone: "Emotional tone",
  characterIds: "Characters",
  locationId: "Location",
  notes: "Notes",
};

function useAction(
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

/** Ids become names, so the writer reviews "Mina", not a UUID. */
function display(
  field: keyof StoryChangeFields,
  value: unknown,
  snapshot: StorySnapshot,
): string {
  if (value === undefined || value === null || value === "") return "";
  if (field === "characterIds" && Array.isArray(value)) {
    return value
      .map(
        (id) =>
          snapshot.characters?.find((x) => x.id === id)?.name ?? "Unknown",
      )
      .join(", ");
  }
  if (field === "locationId") {
    return snapshot.places?.find((x) => x.id === value)?.name ?? "Unknown";
  }
  if (field === "tensionLevel") return `${String(value)} / 10`;
  return String(value).replace(/_/g, " ");
}

function ChangeRow({
  change,
  snapshot,
  outcome,
}: {
  change: StoryChange;
  snapshot: StorySnapshot;
  outcome?: "applied" | "stale" | "failed" | "skipped";
}) {
  const create = isCreate(change);
  const current = currentTarget(change, snapshot) as
    Record<string, unknown> | undefined;
  const stale = outcome === undefined && isStale(change, snapshot) === true;
  const fields = Object.keys(change.fields) as (keyof StoryChangeFields)[];
  const outcomeText = {
    applied: "Saved",
    stale: "Changed since this was drafted — not saved",
    failed: "Could not be saved",
    skipped: "Not attempted",
  };

  return (
    <li
      className="border-b border-ns-border px-4 py-3 last:border-b-0"
      data-cy="assistant-story-change"
    >
      <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-gold">
        {create ? "New" : "Update"} {KIND_LABEL[changeKind(change)]}
      </p>
      <p className="mt-0.5 font-heading text-sm font-semibold text-ns-ink">
        {change.label}
      </p>
      <dl className="mt-2 space-y-2">
        {fields.map((field) => {
          const before = create
            ? ""
            : display(field, current?.[field], snapshot);
          return (
            <div key={field}>
              <dt className="font-ui text-[10px] font-semibold uppercase tracking-wide text-ns-ink-muted">
                {FIELD_LABEL[field]}
              </dt>
              <dd className="mt-0.5 font-ui text-xs leading-5">
                {before && (
                  <p className="line-clamp-3 whitespace-pre-wrap text-ns-ink-muted line-through decoration-red-500/60">
                    {before}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-ns-ink">
                  {display(field, change.fields[field], snapshot)}
                </p>
              </dd>
            </div>
          );
        })}
      </dl>
      {(stale || outcome) && (
        <p
          role="status"
          className={`mt-2 font-ui text-[11px] ${
            outcome === "applied"
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-amber-700 dark:text-amber-300"
          }`}
        >
          {outcome
            ? outcomeText[outcome]
            : "This changed after the suggestion was drafted."}
        </p>
      )}
    </li>
  );
}

export function ProposeStoryChangesCard({
  status,
  result,
}: ToolCallMessagePartProps) {
  const declined = objectValue(result)?.accepted === false;
  if (declined) return null;
  return (
    <div className="my-2 flex items-center gap-2 rounded-ns border border-ns-gold/30 bg-amber-500/5 px-3 py-2 font-ui text-[11px] text-ns-ink-secondary">
      {status.type === "running" ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-ns-gold" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 text-ns-gold" />
      )}
      {status.type === "running"
        ? "Drafting story changes…"
        : "Story changes drafted for review"}
    </div>
  );
}

export function ApplyStoryChangesCard({
  args,
  approval,
  respondToApproval,
  storyId,
  ledger,
}: ToolCallMessagePartProps & {
  storyId: string | undefined;
  ledger: EditorActionLedger | undefined;
}) {
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const messageContent = useAuiState((state) => state.message.content);
  const isLastMessage = useAuiState((state) => state.message.isLast);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const approvalId = approval?.id;
  const action = useAction(ledger, approvalId);
  const proposalId = objectValue(args)?.proposalId;

  const proposal = useMemo<ProposeStoryChangesArgs | null>(() => {
    const parsed = proposeStoryChangesSchema.safeParse(
      proposalArgs(messageContent, "propose_story_changes", proposalId),
    );
    return parsed.success ? parsed.data : null;
  }, [messageContent, proposalId]);

  const characterQuery = useCharacters(storyId);
  const placeQuery = usePlaces(storyId);
  const plotQuery = usePlots(storyId);
  const characters = characterQuery.data;
  const places = placeQuery.data;
  const plots = plotQuery.data;
  // Accepting before these load would mean approving without the before-values.
  const loaded = Boolean(characters && places && plots);
  const loadFailed =
    !loaded &&
    (characterQuery.isError || placeQuery.isError || plotQuery.isError);
  const snapshot = useMemo<StorySnapshot>(
    () => ({ characters, places, plots }),
    [characters, places, plots],
  );

  const decided =
    approval?.approved !== undefined || action.status === "resolved";
  // Once the conversation has moved on, resuming this message's run would
  // rewind it, so an undecided suggestion is closed rather than left live.
  const expired = !decided && !isLastMessage && action.status !== "applying";
  const resolved = decided || expired;
  const busy = action.status === "applying";
  const anyStale =
    !resolved &&
    Boolean(proposal?.changes.some((change) => isStale(change, snapshot)));
  const canApply =
    Boolean(storyId && ledger && approvalId && proposal) &&
    !resolved &&
    !busy &&
    loaded &&
    !anyStale &&
    isOnline;

  const refresh = useCallback(() => {
    if (!storyId) return;
    for (const key of [
      queryKeys.characters.byStory(storyId),
      queryKeys.places.byStory(storyId),
      queryKeys.plots.byStory(storyId),
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }, [queryClient, storyId]);

  // The card compares against cached rosters, so make sure they are current
  // before the writer decides.
  const pending = Boolean(proposal) && !resolved;
  useEffect(() => {
    if (pending) refresh();
  }, [pending, refresh]);

  const resolveDecision = useCallback(
    async (decision: "rejected" | "revision_requested", note?: string) => {
      if (!ledger || !approvalId || resolved || busy) return;
      ledger.resolve(approvalId, { decision, feedback: note });
      try {
        await respondToApproval({ approved: false, reason: decision });
      } catch {
        ledger.reset(approvalId);
        toast.error("The decision could not be recorded. Please try again.");
      }
    },
    [approvalId, busy, ledger, resolved, respondToApproval],
  );

  const apply = useCallback(async () => {
    if (!storyId || !ledger || !approvalId || !proposal || !canApply) return;
    if (!ledger.beginApply(approvalId)) return;
    const results = await applyStoryChanges(
      storyId,
      proposal,
      storyWorldbuildingRepo,
    );
    refresh();
    const saved = allApplied(results);
    ledger.resolve(approvalId, {
      decision: saved ? "applied" : "apply_failed",
      results,
    });
    try {
      await respondToApproval({ approved: true, reason: "story_changes" });
    } catch {
      // The writes already happened; never reset to a state that could re-apply.
      toast.error(
        saved
          ? "The changes were saved, but the assistant could not acknowledge them."
          : "The assistant could not record the save result.",
      );
    }
  }, [
    approvalId,
    canApply,
    ledger,
    proposal,
    refresh,
    respondToApproval,
    storyId,
  ]);

  const submitRevision = async () => {
    const bounded = feedback.trim().slice(0, 500);
    if (bounded) await resolveDecision("revision_requested", bounded);
  };

  const results = action.status === "resolved" ? action.results : undefined;
  const terminalMessage =
    action.status !== "resolved"
      ? approval?.approved === undefined
        ? expired
          ? "This suggestion expired when the conversation moved on. Ask again for a fresh one."
          : null
        : approval.approved
          ? "Saved to your story."
          : "This suggestion is closed. The reply below says what was saved."
      : action.decision === "applied"
        ? "Saved to your story."
        : action.decision === "apply_failed"
          ? "Not everything was saved. See each change above."
          : action.decision === "revision_requested"
            ? "Revision notes sent."
            : "Suggestion rejected. Nothing changed.";
  const count = proposal?.changes.length ?? 0;

  return (
    <section
      className="my-3 overflow-hidden rounded-[0.9rem] border border-ns-gold/35 bg-ns-elevated shadow-ns"
      data-cy="assistant-story-review"
      aria-label="Review story suggestion"
    >
      <header className="border-b border-ns-gold/25 bg-[linear-gradient(120deg,var(--ns-accent-subtle),transparent_70%)] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ns-gold/30 bg-ns-bg text-ns-gold shadow-ns-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ns-gold">
              Story suggestion
            </p>
            <h4 className="mt-0.5 font-heading text-base font-semibold leading-5 text-ns-ink">
              {proposal?.summary ?? "Review unavailable"}
            </h4>
            {proposal?.reason && (
              <p className="mt-1 font-ui text-[11px] leading-4 text-ns-ink-muted">
                {proposal.reason}
              </p>
            )}
          </div>
        </div>
      </header>

      {proposal ? (
        <ul className="border-b border-ns-border">
          {proposal.changes.map((change, index) => (
            <ChangeRow
              key={`${change.operation}:${change.entityId ?? change.label}`}
              change={change}
              snapshot={snapshot}
              outcome={results?.find((item) => item.index === index)?.status}
            />
          ))}
        </ul>
      ) : (
        <p className="border-b border-ns-border px-4 py-3 font-ui text-xs text-ns-destructive">
          The proposal payload could not be matched safely.
        </p>
      )}

      <div className="space-y-3 px-4 py-3">
        {anyStale && (
          <p
            role="status"
            className="font-ui text-xs leading-5 text-amber-700 dark:text-amber-300"
          >
            Part of your story changed after this was drafted. Ask for a
            revision to get an up-to-date suggestion.
          </p>
        )}
        {!loaded && !resolved && (
          <p
            role="status"
            className="font-ui text-xs leading-5 text-ns-ink-muted"
          >
            {loadFailed
              ? "Your story could not be loaded to compare. Reload and try again."
              : "Loading your story to compare…"}
          </p>
        )}
        {!isOnline && !resolved && (
          <p className="flex items-center gap-1.5 font-ui text-xs text-amber-700 dark:text-amber-300">
            <WifiOff className="h-3.5 w-3.5" /> Reconnect before accepting so
            the changes can be saved.
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

        {!showFeedback && !resolved && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-cy="assistant-story-apply"
              disabled={!canApply}
              onClick={() => void apply()}
              className="inline-flex items-center gap-1.5 rounded-ns bg-ns-accent px-3 py-2 font-ui text-xs font-semibold text-white shadow-ns-sm hover:bg-ns-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {busy
                ? "Saving…"
                : count > 1
                  ? `Accept ${count} changes`
                  : "Accept & save"}
            </button>
            <button
              type="button"
              data-cy="assistant-story-reject"
              disabled={busy}
              onClick={() => void resolveDecision("rejected")}
              className="rounded-ns border border-ns-border-strong px-3 py-2 font-ui text-xs font-semibold text-ns-ink-secondary hover:bg-ns-surface-hover disabled:opacity-40"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowFeedback(true)}
              className="rounded-ns px-2 py-2 font-ui text-xs text-ns-accent hover:bg-ns-accent-subtle disabled:opacity-40"
            >
              Ask for revision
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
