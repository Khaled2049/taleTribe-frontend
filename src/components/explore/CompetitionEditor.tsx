import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import PublishCompetitionDialog from "./PublishCompetitionDialog";
import {
  useCancelCompetition,
  useCompetitionQuery,
  useDiscardDraft,
  usePublishCompetition,
  useSaveDraft,
  useUpdateCompetition,
} from "@/hooks/queries/useCompetitionQueries";
import { useTokenBalanceQuery } from "@/hooks/queries/useTokenQueries";
import {
  amountOrNull,
  emptyFormState,
  formStateFrom,
  publishBlockers,
  toDraftInput,
  type CompetitionFormState,
} from "@/lib/competitionDraft";
import { canTransition, isDraftPhase } from "@/lib/competitionPhase";
import { getFeeBps } from "@/lib/competitionListing";
import { formatFeeBps, formatMinorUnits } from "@/lib/money";
import { TALE_SYMBOL } from "@/types/IToken";
import type { CompetitionPhase } from "@/types/ICompetition";

const field =
  "w-full bg-transparent border border-ns-border rounded-ns px-3 py-2 text-sm text-ns-ink disabled:opacity-50";
const label =
  "font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted";
const hint = "font-ui text-[10px] text-ns-ink-muted";

const formatDateShort = (value: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });
};

/** Human gap between two datetime-local values, for the schedule section. */
const windowLength = (from: string, to: string): string | null => {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.round((ms % 86_400_000) / 3_600_000);
  if (days === 0) return `${hours}h`;
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
};

const Section: React.FC<{
  title: string;
  blurb?: string;
  children: React.ReactNode;
}> = ({ title, blurb, children }) => (
  <section className="py-8 border-b border-ns-border">
    <h2 className="font-heading text-[28px] leading-none text-ns-ink">
      {title}
    </h2>
    {blurb && (
      <p className="font-body text-[15px] text-ns-ink-secondary mt-2 max-w-[60ch]">
        {blurb}
      </p>
    )}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">{children}</div>
  </section>
);

/**
 * Create or edit a competition.
 *
 * One page for both, because the two differ only in which fields are frozen:
 * once published, escrow holds money against the prize and entry fee, so those
 * become read-only while the brief and the schedule stay editable.
 */
const CompetitionEditor: React.FC = () => {
  const { competitionId } = useParams<{ competitionId: string }>();
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [form, setForm] = useState<CompetitionFormState>(emptyFormState);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [dateChangeOpen, setDateChangeOpen] = useState(false);

  const { data: competition, isLoading } = useCompetitionQuery(
    competitionId ?? "",
    user?.uid,
  );
  const { data: tokenBalance } = useTokenBalanceQuery(user?.uid);

  const saveDraft = useSaveDraft();
  const publish = usePublishCompetition();
  const discard = useDiscardDraft();
  const updateCompetition = useUpdateCompetition();
  const cancelCompetition = useCancelCompetition();

  const phase: CompetitionPhase = competition?.phase ?? "draft";
  const isDraft = !competitionId || isDraftPhase(phase);
  const canCancel = !!competition && canTransition(phase, "cancelled");
  const feeBps = competition ? getFeeBps(competition) : 1000;

  // Seed once per load rather than on every competition change, so a background
  // refetch cannot clobber what the host is typing.
  useEffect(() => {
    if (seeded || !competitionId) return;
    if (competition) {
      setForm(formStateFrom(competition, formatMinorUnits));
      setSeeded(true);
    }
  }, [competition, competitionId, seeded]);

  const blockers = useMemo(() => publishBlockers(form), [form]);
  const set = (key: keyof CompetitionFormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const prizeMinor = useMemo(
    () => amountOrNull(form.prizeAmount),
    [form.prizeAmount],
  );
  const entryFeeMinor = useMemo(
    () => amountOrNull(form.entryFee),
    [form.entryFee],
  );

  const datesChanged = useMemo(() => {
    if (!competition) return false;
    const original = formStateFrom(competition, formatMinorUnits);
    return (
      original.startDate !== form.startDate ||
      original.deadline !== form.deadline ||
      original.votingDeadline !== form.votingDeadline
    );
  }, [competition, form.startDate, form.deadline, form.votingDeadline]);

  /**
   * Persist the form and return the id, creating the draft on first save.
   *
   * Shared by the Save button and Publish, because publish validates the STORED
   * document — publishing without saving first would check terms the host is no
   * longer looking at.
   */
  const persistDraft = async (): Promise<string> => {
    const id = await saveDraft.mutateAsync(
      toDraftInput(
        form,
        competitionId,
        user?.username || user?.email || undefined,
      ),
    );
    if (!competitionId) {
      navigate(`/competitions/${id}/edit`, { replace: true });
    }
    return id;
  };

  const handleSaveDraft = async () => {
    if (!form.title.trim()) {
      // Both, because the banner sits at the top of a long page and the button
      // is at the bottom of the rail — a scrolled-down host would see neither.
      setError("Give the competition a title before saving.");
      toast.error("Give the competition a title before saving.");
      return;
    }
    setError(null);
    try {
      await persistDraft();
      toast.success("Draft saved");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save draft.";
      setError(message);
      toast.error(message);
    }
  };

  /** Published competitions go through updateCompetition, which refuses the prize. */
  const handleSaveChanges = async () => {
    if (!competitionId) return;
    setError(null);
    try {
      await updateCompetition.mutateAsync({
        competitionId,
        updates: {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          maxParticipants: form.maxParticipants
            ? Number(form.maxParticipants)
            : null,
          startDate: new Date(form.startDate),
          deadline: new Date(form.deadline),
          ...(form.votingDeadline
            ? { votingDeadline: new Date(form.votingDeadline) }
            : {}),
        },
      });
      toast.success("Competition updated");
      setDateChangeOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
      setDateChangeOpen(false);
    }
  };

  /**
   * Save, then publish. Works from `/new` — requiring a manual save first made
   * the button permanently dead on the page most hosts start from.
   */
  const handlePublish = async () => {
    try {
      const id = await persistDraft();
      const landedPhase = await publish.mutateAsync(id);
      toast.success(
        landedPhase === "open"
          ? "Published — entries are open"
          : "Published — it opens on the start date",
      );
      setPublishOpen(false);
      navigate(`/competitions/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish.";
      setError(message);
      toast.error(message);
      setPublishOpen(false);
    }
  };

  const handleDiscard = async () => {
    if (!competitionId) return;
    try {
      await discard.mutateAsync(competitionId);
      toast.success("Draft discarded");
      navigate("/competitions");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to discard draft.",
      );
    }
  };

  const handleCancel = () => {
    if (!competitionId) return;
    cancelCompetition.mutate(
      { competitionId },
      {
        onSuccess: () => {
          toast.success("Competition cancelled and escrow refunded");
          navigate(`/competitions/${competitionId}`);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to cancel."),
      },
    );
    setCancelOpen(false);
  };

  const openStartsInPast = form.startDate
    ? new Date(form.startDate).getTime() <= Date.now()
    : false;

  if (!user?.isAdmin) {
    return (
      <div className="py-20 text-center">
        <p className="font-heading text-3xl text-ns-ink-muted">
          Only admins can host a competition.
        </p>
      </div>
    );
  }

  if (competitionId && isLoading && !seeded) {
    return (
      <div className="py-20 text-center">
        <p className="font-body text-sm text-ns-ink-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen container mx-auto px-4 max-w-7xl">
      <div className="flex items-center justify-between gap-4 py-[22px] border-b border-ns-border">
        <Link
          to="/competitions"
          className="inline-flex items-center gap-2 font-ui text-[13px] font-semibold text-ns-ink-secondary hover:text-ns-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All competitions
        </Link>
        <Badge variant={isDraft ? "outline" : "default"}>
          {isDraft ? "Draft — not published" : "Published"}
        </Badge>
      </div>

      {error && (
        <div className="mt-6 rounded-ns border border-ns-destructive/30 bg-ns-destructive/10 p-3 text-sm text-ns-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12 items-start mt-2">
        <div>
          <h1 className="font-heading font-light text-[3rem] leading-[1] tracking-[-0.02em] text-ns-ink mt-8">
            {competitionId ? "Edit competition" : "Host a competition"}
          </h1>

          <Section
            title="Brief"
            blurb="What entrants read before deciding whether to write for you."
          >
            <div className="space-y-1.5">
              <label className={label}>Title</label>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={field}
                placeholder="Competition title"
              />
            </div>
            <div className="space-y-1.5">
              <label className={label}>Category</label>
              <input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className={field}
                placeholder="Fantasy, Horror, Short Story…"
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className={label}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className={`${field} min-h-[140px]`}
                placeholder="Describe the competition and what you expect from an entry"
              />
            </div>
            <div className="space-y-1.5">
              <label className={label}>Tags</label>
              <input
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                className={field}
                placeholder="Fantasy, Lore, Adventure"
              />
              <p className={hint}>Comma separated.</p>
            </div>
            <div className="space-y-1.5">
              <label className={label}>Max entrants (optional)</label>
              <input
                type="number"
                min="1"
                value={form.maxParticipants}
                onChange={(e) => set("maxParticipants", e.target.value)}
                className={field}
                placeholder="No limit"
              />
            </div>
          </Section>

          <Section
            title="Money"
            blurb={
              isDraft
                ? "Nothing moves until you publish. Both are fixed after that."
                : "Locked. Escrow already holds money against these terms."
            }
          >
            <div className="space-y-1.5">
              <label className={label}>Prize pool ({TALE_SYMBOL})</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.prizeAmount}
                onChange={(e) => set("prizeAmount", e.target.value)}
                disabled={!isDraft}
                className={field}
                placeholder="1000"
              />
              <p className={hint}>
                Moved from your balance into escrow on publish. Winner takes
                all.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className={label}>
                Entry fee ({TALE_SYMBOL}) — optional
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.entryFee}
                onChange={(e) => set("entryFee", e.target.value)}
                disabled={!isDraft}
                className={field}
                placeholder="Leave blank for free entry"
              />
              <p className={hint}>
                {entryFeeMinor
                  ? `Held in escrow until settlement. The platform takes ${formatFeeBps(feeBps)} and you keep the rest — it does not increase the prize.`
                  : "Blank means free to enter."}
              </p>
            </div>
          </Section>

          <Section
            title="Schedule"
            blurb="Entrants see these dates. They can still be edited after publishing."
          >
            <div className="space-y-1.5">
              <label className={label}>Opens</label>
              <input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                className={field}
              />
            </div>
            <div className="space-y-1.5">
              <label className={label}>Submissions close</label>
              <input
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
                className={field}
              />
              <p className={hint}>
                {windowLength(form.startDate, form.deadline)
                  ? `${windowLength(form.startDate, form.deadline)} to write and enter.`
                  : "Must be after the opening date."}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className={label}>Voting closes</label>
              <input
                type="datetime-local"
                value={form.votingDeadline}
                onChange={(e) => set("votingDeadline", e.target.value)}
                className={field}
              />
              <p className={hint}>
                {windowLength(form.deadline, form.votingDeadline)
                  ? `${windowLength(form.deadline, form.votingDeadline)} of voting. Settles automatically after this.`
                  : "At least an hour after submissions close."}
              </p>
            </div>
          </Section>

          {!isDraft && canCancel && (
            <div className="py-8">
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="font-ui text-[13px] font-semibold text-ns-destructive hover:opacity-80 transition-opacity"
              >
                Cancel this competition
              </button>
              <p className={`${hint} mt-1`}>
                Refunds the prize to you and every entry fee to whoever paid it.
              </p>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 rounded-[14px] border border-ns-border bg-ns-elevated p-[22px] flex flex-col gap-4 mt-8">
          {/* Reflects the form as it is typed, so the rail is a preview of the
              competition rather than only a total. */}
          <div>
            <p className={label}>{form.category.trim() || "Uncategorised"}</p>
            <p className="font-heading text-[24px] leading-[1.1] text-ns-ink mt-1 break-words">
              {form.title.trim() || "Untitled competition"}
            </p>
            {form.description.trim() && (
              <p className="font-body text-[14px] leading-relaxed text-ns-ink-secondary mt-3 whitespace-pre-wrap break-words">
                {form.description.trim()}
              </p>
            )}
          </div>

          <div className="h-px bg-ns-border" />

          <div>
            <p className={label}>Prize pool</p>
            <p className="font-heading text-[40px] leading-[0.9] text-ns-gold-bright mt-1">
              {prizeMinor ? formatMinorUnits(prizeMinor) : "—"}
            </p>
            <p className={`${hint} mt-1`}>{TALE_SYMBOL} · winner takes all</p>
          </div>

          <div className="h-px bg-ns-border" />

          <div className="flex items-center justify-between">
            <span className="font-ui text-[13px] text-ns-ink-muted">Entry</span>
            <span className="font-ui text-[13px] font-semibold tabular-nums">
              {entryFeeMinor ? (
                <span className="text-ns-ink">
                  {formatMinorUnits(entryFeeMinor)} {TALE_SYMBOL}
                </span>
              ) : (
                <span className="text-ns-success">Free</span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-ui text-[13px] text-ns-ink-muted">Opens</span>
            <span className="font-ui text-[13px] font-semibold text-ns-ink">
              {formatDateShort(form.startDate)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-ui text-[13px] text-ns-ink-muted">
              Entries close
            </span>
            <span className="font-ui text-[13px] font-semibold text-ns-ink">
              {formatDateShort(form.deadline)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-ui text-[13px] text-ns-ink-muted">
              Voting closes
            </span>
            <span className="font-ui text-[13px] font-semibold text-ns-ink">
              {formatDateShort(form.votingDeadline)}
            </span>
          </div>

          <div className="h-px bg-ns-border" />

          <div className="flex items-center justify-between">
            <span className="font-ui text-[13px] text-ns-ink-muted">
              Your balance
            </span>
            <span className="font-ui text-[13px] font-semibold text-ns-ink tabular-nums">
              {tokenBalance
                ? `${formatMinorUnits(tokenBalance.balance)} ${TALE_SYMBOL}`
                : "…"}
            </span>
          </div>

          <div className="h-px bg-ns-border" />

          {isDraft ? (
            <>
              {blockers.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 font-ui text-[11px] uppercase tracking-[0.14em] text-ns-ink-muted">
                    <Info className="w-3 h-3" />
                    Before publishing
                  </span>
                  <ul className="flex flex-col gap-1">
                    {blockers.map((blocker) => (
                      <li
                        key={blocker}
                        className="font-ui text-[12px] text-ns-ink-secondary"
                      >
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {blockers.length === 0 && (
                <p className="flex items-center gap-1.5 font-ui text-[12px] text-ns-success">
                  <Check className="w-3.5 h-3.5" />
                  Ready to publish
                </p>
              )}

              <Button
                onClick={() => setPublishOpen(true)}
                disabled={blockers.length > 0 || saveDraft.isPending}
                className="bg-ns-ink text-ns-bg hover:opacity-90 w-full"
              >
                Publish
              </Button>
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={saveDraft.isPending}
                className="w-full"
              >
                {saveDraft.isPending ? "Saving…" : "Save draft"}
              </Button>
              {competitionId && (
                <button
                  type="button"
                  onClick={() => setDiscardOpen(true)}
                  className="font-ui text-[12px] text-ns-destructive hover:opacity-80 transition-opacity"
                >
                  Discard draft
                </button>
              )}
            </>
          ) : (
            <Button
              onClick={() =>
                datesChanged ? setDateChangeOpen(true) : handleSaveChanges()
              }
              disabled={updateCompetition.isPending}
              className="bg-ns-ink text-ns-bg hover:opacity-90 w-full"
            >
              {updateCompetition.isPending ? "Saving…" : "Save changes"}
            </Button>
          )}
        </aside>
      </div>

      {prizeMinor && (
        <PublishCompetitionDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          prizeAmount={prizeMinor}
          entryFee={entryFeeMinor}
          balance={tokenBalance?.balance}
          opensImmediately={openStartsInPast}
          onConfirm={handlePublish}
          isPublishing={publish.isPending || saveDraft.isPending}
        />
      )}

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this draft?"
        description="It is deleted for good. No money is involved — nothing has been escrowed for an unpublished competition."
        confirmLabel="Discard draft"
        cancelLabel="Keep editing"
        variant="danger"
        onConfirm={handleDiscard}
      />

      <ConfirmDialog
        open={dateChangeOpen}
        onOpenChange={setDateChangeOpen}
        title="Change the dates?"
        description="Entrants are already acting on the current schedule. Moving a deadline changes the terms they entered under."
        confirmLabel="Change dates"
        cancelLabel="Keep as is"
        onConfirm={handleSaveChanges}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this competition?"
        description="The prize is refunded to you and every entry fee goes back to whoever paid it. It can't be reopened."
        confirmLabel="Cancel competition"
        cancelLabel="Keep competition"
        variant="danger"
        onConfirm={handleCancel}
      />
    </div>
  );
};

export default CompetitionEditor;
