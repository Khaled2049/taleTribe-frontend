import { Link } from "react-router-dom";
import type { ICompetitionSubmission } from "@/types/ICompetitionSubmission";

interface SubmissionCardProps {
  submission: ICompetitionSubmission;
  /** Voting controls are hidden outside the voting phase. */
  canVote: boolean;
  selected: boolean;
  onToggleVote: (submissionId: string) => void;
  disabled?: boolean;
  isOwnEntry?: boolean;
  /**
   * The voter has used every vote they have. Only blocks entries they haven't
   * backed — a backed one stays clickable so they can unpick it and swap.
   */
  atVoteLimit?: boolean;
  /** Only used to explain `atVoteLimit`. */
  maxVotes?: number;
  /** Rank is only ever known after settlement. */
  rank?: number;
}

const SubmissionCard: React.FC<SubmissionCardProps> = ({
  submission,
  canVote,
  selected,
  onToggleVote,
  disabled = false,
  isOwnEntry = false,
  atVoteLimit = false,
  maxVotes,
  rank,
}) => {
  const blockedByLimit = atVoteLimit && !selected;
  return (
    <article className="group border-b border-ns-border py-6 flex items-start gap-5">
      {submission.coverImageUrl ? (
        <img
          src={submission.coverImageUrl}
          alt=""
          className="w-16 h-24 object-cover shrink-0 rounded-ns bg-ns-surface"
        />
      ) : (
        <div className="w-16 h-24 shrink-0 rounded-ns bg-ns-surface" />
      )}

      <div className="flex-1 min-w-0">
        {rank !== undefined && (
          <p className="font-ui text-[10px] font-bold tracking-[0.18em] uppercase text-ns-gold-bright mb-1">
            {rank === 1 ? "Winner" : `Rank ${rank}`}
          </p>
        )}

        <h3 className="font-heading text-xl md:text-2xl font-light text-ns-ink leading-tight">
          <Link
            to={`/story/${submission.storyId}`}
            className="hover:text-ns-accent transition-colors"
          >
            {submission.storyTitle}
          </Link>
        </h3>

        <p className="font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted mt-1">
          {submission.storyAuthorName ?? "Anonymous"}
          {isOwnEntry && " · your entry"}
        </p>

        {/* A vote count exists only after settlement — during voting there is
            no readable tally anywhere, by design. */}
        {submission.voteCount !== undefined && (
          <p className="font-ui text-[11px] font-semibold tracking-wide text-ns-ink-secondary mt-2 tabular-nums">
            {submission.voteCount} vote{submission.voteCount === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2">
        <Link
          to={`/story/${submission.storyId}`}
          className="font-ui text-[10px] font-semibold tracking-[0.12em] uppercase text-ns-ink-muted hover:text-ns-ink transition-colors"
        >
          Read
        </Link>

        {canVote && (
          <button
            type="button"
            onClick={() => onToggleVote(submission.id)}
            disabled={disabled || isOwnEntry || blockedByLimit}
            title={
              isOwnEntry
                ? "You can't vote for your own entry"
                : blockedByLimit
                  ? `You've backed ${maxVotes ?? 0} of ${maxVotes ?? 0} — unpick one to swap`
                  : undefined
            }
            className={`font-ui text-[10px] font-bold tracking-[0.12em] uppercase px-3 py-1.5 rounded-ns border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              selected
                ? "bg-ns-ink text-ns-bg border-ns-ink"
                : "text-ns-ink border-ns-border-strong hover:bg-ns-ink hover:text-ns-bg"
            }`}
          >
            {selected ? "Backed" : "Back this"}
          </button>
        )}
      </div>
    </article>
  );
};

export default SubmissionCard;
