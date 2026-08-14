import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  useCancelCompetition,
  useCastVote,
  useCompetitionQuery,
  useJoinCompetition,
  useMyBallotQuery,
  useSubmissionsQuery,
  useSubmitStory,
  useWithdrawSubmission,
} from "@/hooks/queries/useCompetitionQueries";
import { formatCountdown, useNow } from "@/hooks/useCountdown";
import {
  DEFAULT_MAX_VOTES_PER_USER,
  getMaxVotesPerUser,
  isCompetitionFull,
} from "@/lib/competitionListing";
import { PHASE_COPY } from "@/lib/competitionPhaseCopy";
import { canTransition, isEditablePhase } from "@/lib/competitionPhase";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { HostPrizeDialog } from "./HostPrizeDialog";
import CompetitionDetailHero from "./CompetitionDetailHero";
import CompetitionBrief from "./CompetitionBrief";
import CompetitionEnteredCard from "./CompetitionEnteredCard";
import CompetitionKeyDatesCard from "./CompetitionKeyDatesCard";
import CompetitionCountdown from "./CompetitionCountdown";
import CompetitionResultsCard from "./CompetitionResultsCard";
import SubmissionCard from "./SubmissionCard";
import SubmissionPicker from "./SubmissionPicker";
import type { CompetitionPhase } from "@/types/ICompetition";
import type { ICompetitionSubmission } from "@/types/ICompetitionSubmission";


/**
 * Stable per-viewer ordering.
 *
 * Entries are shuffled by a hash of (competition, viewer, submission) so
 * position never implies standing and every viewer sees a different order —
 * which blunts the first-position bias a fixed list would create. It is
 * deterministic, so the order does not jump around as the viewer votes.
 */
const shuffleForViewer = (
  submissions: ICompetitionSubmission[],
  seed: string,
): ICompetitionSubmission[] => {
  const score = (id: string): number => {
    let hash = 2166136261;
    const input = `${seed}:${id}`;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  return [...submissions].sort((a, b) => score(a.id) - score(b.id));
};

const CompetitionDetail: React.FC = () => {
  const { competitionId = "" } = useParams<{ competitionId: string }>();
  const { user } = useAuthContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const now = useNow();

  /** The brief is always on the page now; on narrow screens it may be above. */
  const scrollToBrief = () =>
    document.getElementById("brief")?.scrollIntoView({ behavior: "smooth" });

  const { data: competition, isLoading } = useCompetitionQuery(
    competitionId,
    user?.uid,
  );
  const { data: submissions } = useSubmissionsQuery(competitionId);
  const { data: ballot } = useMyBallotQuery(competitionId, user?.uid);

  const joinCompetition = useJoinCompetition(user?.uid);
  const submitStory = useSubmitStory(competitionId);
  const withdrawSubmission = useWithdrawSubmission(competitionId);
  const castVote = useCastVote(competitionId, user?.uid);
  const cancelCompetition = useCancelCompetition();

  const phase: CompetitionPhase = competition?.phase ?? "open";
  const entries = useMemo(() => submissions ?? [], [submissions]);

  const myEntry = entries.find((entry) => entry.userId === user?.uid);
  const selected = ballot?.submissionIds ?? [];

  // Read the competition's own rule rather than a local constant, so the UI
  // polices exactly the number castCompetitionVote enforces.
  const maxVotes = competition
    ? getMaxVotesPerUser(competition)
    : DEFAULT_MAX_VOTES_PER_USER;
  const atVoteLimit = selected.length >= maxVotes;

  const ordered = useMemo(() => {
    if (phase === "settled" && competition?.results?.length) {
      // Once settled, the server's ranking IS the result — mirror it exactly
      // rather than re-deriving an order from denormalized vote counts.
      const rankOf = new Map(
        competition.results.map((result) => [result.submissionId, result.rank]),
      );
      return [...entries].sort(
        (a, b) =>
          (rankOf.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (rankOf.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
    }
    return shuffleForViewer(entries, `${competitionId}:${user?.uid ?? "anon"}`);
  }, [entries, phase, competitionId, user?.uid, competition?.results]);

  const handleToggleVote = (submissionId: string) => {
    if (!user) {
      toast.error("Sign in to vote");
      return;
    }

    const next = selected.includes(submissionId)
      ? selected.filter((id) => id !== submissionId)
      : [...selected, submissionId];

    if (next.length > maxVotes) {
      toast.error(`You can back at most ${maxVotes} entries`);
      return;
    }

    castVote.mutate(next, {
      onError: (error) =>
        toast.error(
          error instanceof Error ? error.message : "Failed to record your vote",
        ),
    });
  };

  /**
   * Entering implies joining. The server requires participation before an
   * entry, so join first when needed rather than making the reader do it as a
   * separate step and leaving the entry action inert until they do.
   */
  const handlePickStory = async (storyId: string) => {
    try {
      if (!competition?.isJoined) {
        await joinCompetition.mutateAsync(competitionId);
      }
      await submitStory.mutateAsync(storyId);
      toast.success("Your entry is in");
      setPickerOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit your entry",
      );
    }
  };

  /**
   * Cancel, not delete. A competition holding a prize pool can't be removed —
   * the escrowed tokens go back to the host instead.
   */
  const handleCancelCompetition = () => {
    cancelCompetition.mutate(
      { competitionId },
      {
        onSuccess: () => {
          toast.success("Competition cancelled and prize refunded");
          setCancelOpen(false);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to cancel competition",
          );
          setCancelOpen(false);
        },
      },
    );
  };

  /** No server-side edit-in-place — withdraw, then let the picker reopen. */
  const handleEditEntry = async () => {
    try {
      await withdrawSubmission.mutateAsync();
      setPickerOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to withdraw your entry",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <p className="font-body text-sm text-ns-ink-muted">Loading…</p>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="py-20 text-center">
        <p className="font-heading text-3xl text-ns-ink-muted">
          Competition not found.
        </p>
      </div>
    );
  }

  const copy = PHASE_COPY[phase];
  const isCreator = competition.creatorId === user?.uid;
  const full = isCompetitionFull(competition);
  /**
   * The entry countdown only means something while an entry is still possible.
   * A cancelled competition can sit on a future deadline, so the clock alone
   * isn't enough — it would count down to something that will never happen.
   */
  const showEntryCountdown =
    (phase === "draft" || phase === "open") &&
    !formatCountdown(competition.deadline, now).isPast;

  // Same rule the server applies in assertCanManage (competitionEndpoints.ts):
  // the host, or any admin. This only decides what is offered — the endpoints
  // re-check it, so hiding the buttons is not what makes it safe.
  const canManage = isCreator || !!user?.isAdmin;
  const canEdit = isEditablePhase(phase);
  const canCancel = canTransition(phase, "cancelled");

  // The hero's call to action. `null` means "no actionable button" — the hero
  // then falls back to phase/sign-in/creator copy instead.
  let cta: { label: string; onClick?: () => void; disabled?: boolean } | null = null;
  if (!myEntry && user && !isCreator && phase === "open") {
    cta = full
      ? { label: "Competition is full", disabled: true }
      : {
          label: competition.isJoined ? "Continue your entry" : "Enter this competition",
          onClick: () => setPickerOpen(true),
        };
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between gap-4 py-[22px] border-b border-ns-border">
        <Link
          to="/explore/competitions"
          className="inline-flex items-center gap-2 font-ui text-[13px] font-semibold text-ns-ink-secondary hover:text-ns-ink transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All competitions
        </Link>

        {canManage && (
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted">
              {isCreator ? "You host this" : "Admin"}
            </span>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              disabled={!canEdit}
              title={
                canEdit
                  ? undefined
                  : `A competition in the ${phase} phase can no longer be edited`
              }
              className="font-ui text-[13px] font-semibold text-ns-ink-secondary hover:text-ns-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-ns-ink-secondary"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              disabled={!canCancel || cancelCompetition.isPending}
              title={
                canCancel
                  ? undefined
                  : `A competition in the ${phase} phase can no longer be cancelled`
              }
              className="font-ui text-[13px] font-semibold text-ns-destructive hover:text-ns-destructive-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-ns-destructive"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {canManage && (
        <>
          <HostPrizeDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            editingCompetition={competition}
          />
          <ConfirmDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            title="Cancel this competition?"
            description="The prize pool is refunded to the host and it can't be reopened."
            confirmLabel="Cancel competition"
            cancelLabel="Keep competition"
            variant="danger"
            onConfirm={handleCancelCompetition}
          />
        </>
      )}

      <CompetitionDetailHero
        competition={competition}
        now={now}
        phaseLabel={copy.label}
        phaseBlurb={copy.blurb}
        hasEntered={!!myEntry}
        signedOut={!user}
        isCreator={isCreator}
        ctaLabel={cta?.label}
        onCta={cta?.onClick}
        ctaDisabled={cta?.disabled}
      />

      {/* The rail only carries the "you're entered" card, so the second column
          is dropped entirely when there's nothing to put in it — otherwise the
          brief would sit against 348px of empty space. */}
      <div
        className={`grid grid-cols-1 gap-12 items-start mt-8 ${
          myEntry ? "lg:grid-cols-[1fr_348px]" : ""
        }`}
      >
        <div>
          {phase === "settled" && competition.results && (
            <CompetitionResultsCard
              competition={competition}
              entries={entries}
              currentUserId={user?.uid}
            />
          )}

          <section id="brief" className="scroll-mt-24">
            <CompetitionBrief competition={competition} />

            {/* The countdown disappears once entries close, so the two-column
                split goes with it — otherwise the key dates would sit at half
                width against an empty cell. */}
            <div
              className={`grid grid-cols-1 gap-4 mt-9 ${
                showEntryCountdown ? "md:grid-cols-2" : ""
              }`}
            >
              {showEntryCountdown && (
                <CompetitionCountdown competition={competition} now={now} />
              )}
              <CompetitionKeyDatesCard competition={competition} />
            </div>
          </section>

          <section id="entrants" className="mt-14 scroll-mt-24">
            <div className="flex items-center gap-4 mb-5">
              <h2 className="font-heading text-[32px] text-ns-ink shrink-0">
                Entrants
              </h2>
              <div className="h-px flex-1 bg-ns-border" />
              <span className="font-ui text-[13px] text-ns-ink-muted tabular-nums shrink-0">
                {entries.length}
              </span>
            </div>

            {phase === "voting" && user && (
              <p className="font-ui text-[11px] tracking-[0.1em] uppercase text-ns-ink-secondary mb-6">
                You've backed {selected.length} of {maxVotes} ·{" "}
                {competition.ballotCount ?? 0} ballots cast so far
                {atVoteLimit && " · unpick one to swap"}
              </p>
            )}

            {ordered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="font-heading text-2xl text-ns-ink-muted">
                  No entries yet.
                </p>
              </div>
            ) : (
              <div className="border-t border-ns-border">
                {ordered.map((submission, index) => (
                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    canVote={phase === "voting" && !!user}
                    selected={selected.includes(submission.id)}
                    onToggleVote={handleToggleVote}
                    disabled={castVote.isPending}
                    isOwnEntry={submission.userId === user?.uid}
                    atVoteLimit={atVoteLimit}
                    maxVotes={maxVotes}
                    rank={phase === "settled" ? index + 1 : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {myEntry && (
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
            <CompetitionEnteredCard
              competition={competition}
              entry={myEntry}
              onEdit={handleEditEntry}
              onReadBrief={scrollToBrief}
              busy={withdrawSubmission.isPending}
            />
          </aside>
        )}
      </div>

      {user && (
        <SubmissionPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          userId={user.uid}
          onPick={handlePickStory}
          isSubmitting={submitStory.isPending || joinCompetition.isPending}
        />
      )}
    </div>
  );
};

export default CompetitionDetail;
