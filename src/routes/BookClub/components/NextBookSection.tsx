import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { IBookOfTheMonth, IClub, IPoll } from "@/types/IClub";
import { bookClubRepo } from "../bookClubRepo";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { BookPicker } from "@/components/common/BookPicker";
import { RATE_LIMITS } from "@/config/rateLimits";

interface NextBookSectionProps {
  club: IClub;
  isCreator: boolean;
}

/**
 * Voting on the club's next book. Poll creation is book-selection only;
 * legacy polls of other types still render read-only.
 */
const NextBookSection: React.FC<NextBookSectionProps> = ({
  club,
  isCreator,
}) => {
  const { user } = useAuthContext();
  const polls = club.polls || [];
  const activePolls = polls.filter((p) => p.isActive);
  const pastPolls = polls.filter((p) => !p.isActive);

  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticVotes, setOptimisticVotes] = useState<
    Record<string, number>
  >({});
  const [adoptTarget, setAdoptTarget] = useState<{
    poll: IPoll;
    book: IBookOfTheMonth;
  } | null>(null);
  const [isAdopting, setIsAdopting] = useState(false);

  const [newPoll, setNewPoll] = useState({
    question: "What should we read next?",
    options: [] as Array<{ text: string; bookData?: IBookOfTheMonth }>,
    endDate: "",
  });

  const handleAddBookOption = (book: IBookOfTheMonth) => {
    setError(null);

    if (newPoll.options.length >= RATE_LIMITS.MAX_POLL_OPTIONS) {
      setError(
        `Maximum ${RATE_LIMITS.MAX_POLL_OPTIONS} options allowed per poll`,
      );
      return;
    }
    if (newPoll.options.some((o) => o.bookData?.id === book.id)) {
      setError("That book is already an option");
      return;
    }
    const optionText = book.volumeInfo.title;
    if (optionText.length > RATE_LIMITS.MAX_POLL_OPTION_LENGTH) {
      setError(
        `Option text is too long. Maximum ${RATE_LIMITS.MAX_POLL_OPTION_LENGTH} characters allowed.`,
      );
      return;
    }

    setNewPoll((prev) => ({
      ...prev,
      options: [...prev.options, { text: optionText, bookData: book }],
    }));
  };

  const handleRemoveOption = (index: number) => {
    setNewPoll((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const handleCreatePoll = async () => {
    setError(null);

    if (!newPoll.question.trim()) {
      setError("Please enter a question");
      return;
    }
    if (newPoll.question.length > RATE_LIMITS.MAX_POLL_QUESTION_LENGTH) {
      setError(
        `Question is too long. Maximum ${RATE_LIMITS.MAX_POLL_QUESTION_LENGTH} characters allowed.`,
      );
      return;
    }
    if (newPoll.options.length < 2) {
      setError("Please add at least 2 books");
      return;
    }

    setIsSaving(true);
    try {
      await bookClubRepo.createPoll(club.id, {
        type: "book-selection",
        question: newPoll.question.trim(),
        options: newPoll.options,
        ...(newPoll.endDate ? { endDate: newPoll.endDate } : {}),
      });

      setIsCreatingPoll(false);
      setNewPoll({
        question: "What should we read next?",
        options: [],
        endDate: "",
      });
    } catch (err) {
      console.error("Error creating poll:", err);
      setError(err instanceof Error ? err.message : "Failed to create poll");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!user) return;

    const poll = polls.find((p) => p.id === pollId);
    const currentVote = poll?.votes[user.uid];
    setOptimisticVotes((prev) => ({ ...prev, [pollId]: optionIndex }));

    try {
      await bookClubRepo.voteOnPoll(club.id, pollId, user.uid, optionIndex);
    } catch (err) {
      console.error("Error voting:", err);
      setOptimisticVotes((prev) => {
        const next = { ...prev };
        if (currentVote !== undefined) {
          next[pollId] = currentVote;
        } else {
          delete next[pollId];
        }
        return next;
      });
    }
  };

  const handleAdoptWinner = async () => {
    if (!adoptTarget) return;
    setIsAdopting(true);
    try {
      await bookClubRepo.updateBookOfTheMonth(club.id, adoptTarget.book);
      await bookClubRepo.closePoll(club.id, adoptTarget.poll.id);
      setAdoptTarget(null);
    } catch (err) {
      console.error("Error adopting winner:", err);
    } finally {
      setIsAdopting(false);
    }
  };

  const getUserVote = (poll: IPoll): number | null => {
    if (!user) return null;
    if (optimisticVotes[poll.id] !== undefined) {
      return optimisticVotes[poll.id];
    }
    return poll.votes[user.uid] !== undefined ? poll.votes[user.uid] : null;
  };

  const getVoteCounts = (poll: IPoll): number[] => {
    const counts = new Array(poll.options.length).fill(0);
    Object.values(poll.votes).forEach((optionIndex) => {
      if (optionIndex >= 0 && optionIndex < poll.options.length) {
        counts[optionIndex]++;
      }
    });
    if (user && optimisticVotes[poll.id] !== undefined) {
      const optimisticVote = optimisticVotes[poll.id];
      if (
        optimisticVote >= 0 &&
        optimisticVote < poll.options.length &&
        poll.votes[user.uid] === undefined
      ) {
        counts[optimisticVote]++;
      }
    }
    return counts;
  };

  const getTotalVotes = (poll: IPoll): number => Object.keys(poll.votes).length;

  const getPercentage = (count: number, total: number): number =>
    total === 0 ? 0 : Math.round((count / total) * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <p className="font-body text-sm italic text-ns-ink-muted">
          {activePolls.length === 0
            ? isCreator
              ? "No vote running — propose a shortlist for the next read."
              : "No vote running right now."
            : "Voting is open — pick the club's next read."}
        </p>
        {isCreator && (
          <button
            type="button"
            onClick={() => setIsCreatingPoll(true)}
            className="font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-ns-ink-muted hover:text-ns-accent transition-colors shrink-0"
          >
            Propose books →
          </button>
        )}
      </div>

      {/* active polls */}
      <div className="space-y-8">
        {activePolls.map((poll) => {
          const userVote = getUserVote(poll);
          const voteCounts = getVoteCounts(poll);
          const totalVotes = getTotalVotes(poll);
          const winningIndex =
            totalVotes > 0 ? voteCounts.indexOf(Math.max(...voteCounts)) : -1;
          const winningBook =
            winningIndex >= 0
              ? poll.options[winningIndex]?.bookData
              : undefined;

          return (
            <div key={poll.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
                <h3 className="font-heading text-xl text-ns-ink">
                  {poll.question}
                </h3>
                <span className="font-ui text-xs text-ns-ink-muted">
                  {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                  {poll.endDate &&
                    ` · ends ${new Date(poll.endDate).toLocaleDateString()}`}
                </span>
              </div>

              <div>
                {poll.options.map((option, index) => {
                  const count = voteCounts[index];
                  const percentage = getPercentage(count, totalVotes);
                  const isSelected = userVote === index;
                  const thumbnail =
                    option.bookData?.volumeInfo.imageLinks?.thumbnail;

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleVote(poll.id, index)}
                      disabled={!user}
                      className="w-full text-left py-3 border-t border-ns-border first:border-t-0 group disabled:cursor-default"
                    >
                      <div className="flex items-center gap-3">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt=""
                            className="w-8 h-11 object-cover rounded-ns shadow-ns-sm shrink-0"
                          />
                        ) : (
                          <span className="w-8 h-11 shrink-0 rounded-ns bg-ns-surface border border-ns-border flex items-center justify-center font-heading text-sm text-ns-ink-muted">
                            {option.text.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="flex-1 min-w-0">
                          <span
                            className={`block font-heading text-base truncate transition-colors ${
                              isSelected
                                ? "text-ns-accent"
                                : "text-ns-ink group-hover:text-ns-accent"
                            }`}
                          >
                            {option.text}
                          </span>
                          {option.bookData?.volumeInfo.authors && (
                            <span className="block font-ui text-xs text-ns-ink-muted truncate">
                              by {option.bookData.volumeInfo.authors.join(", ")}
                              {option.bookData.source === "novelsync" &&
                                " · on NovelSync"}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {isSelected && (
                            <Check size={14} className="text-ns-accent" />
                          )}
                          {userVote !== null && (
                            <span className="font-ui text-xs font-semibold text-ns-ink-secondary tabular-nums">
                              {percentage}%
                            </span>
                          )}
                        </span>
                      </div>
                      {userVote !== null && (
                        <div className="mt-2 ml-11 h-1 bg-ns-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isSelected ? "bg-ns-accent" : "bg-ns-ink-muted"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {isCreator && totalVotes > 0 && winningBook && (
                <button
                  type="button"
                  onClick={() => setAdoptTarget({ poll, book: winningBook })}
                  className="mt-3 font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-ns-accent hover:opacity-80 transition-opacity"
                >
                  Adopt winner as current book →
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* past polls */}
      {pastPolls.length > 0 && (
        <div className={activePolls.length > 0 ? "mt-10" : ""}>
          <p className="font-ui text-[10px] font-semibold tracking-[0.18em] uppercase text-ns-ink-muted mb-3">
            Past questions
          </p>
          <div className="space-y-5">
            {pastPolls.map((poll) => {
              const voteCounts = getVoteCounts(poll);
              const totalVotes = getTotalVotes(poll);
              const winningIndex = voteCounts.indexOf(Math.max(...voteCounts));

              return (
                <div key={poll.id} className="opacity-70">
                  <p className="font-heading text-base text-ns-ink mb-1">
                    {poll.question}
                  </p>
                  <div className="space-y-0.5">
                    {poll.options.map((option, index) => (
                      <p
                        key={index}
                        className={`font-ui text-xs ${
                          index === winningIndex && totalVotes > 0
                            ? "text-ns-accent font-semibold"
                            : "text-ns-ink-muted"
                        }`}
                      >
                        {option.text} — {voteCounts[index]} vote
                        {voteCounts[index] !== 1 ? "s" : ""} (
                        {getPercentage(voteCounts[index], totalVotes)}%)
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* create poll dialog */}
      <Dialog open={isCreatingPoll} onOpenChange={setIsCreatingPoll}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-ns-ink">
              Propose the next read
            </DialogTitle>
            <DialogDescription>
              Add at least two books for members to vote on.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="poll-question">Question</Label>
              <div className="relative">
                <Input
                  id="poll-question"
                  value={newPoll.question}
                  onChange={(e) =>
                    setNewPoll({ ...newPoll, question: e.target.value })
                  }
                  maxLength={RATE_LIMITS.MAX_POLL_QUESTION_LENGTH}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 font-ui text-xs text-ns-ink-muted">
                  {newPoll.question.length}/
                  {RATE_LIMITS.MAX_POLL_QUESTION_LENGTH}
                </span>
              </div>
            </div>

            {newPoll.options.length > 0 && (
              <div className="space-y-1">
                <Label>
                  Shortlist ({newPoll.options.length}/
                  {RATE_LIMITS.MAX_POLL_OPTIONS})
                </Label>
                {newPoll.options.map((option, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 py-1.5 border-b border-ns-border"
                  >
                    <span className="font-heading text-sm text-ns-ink truncate">
                      {option.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="text-ns-ink-muted hover:text-ns-accent transition-colors shrink-0"
                      aria-label={`Remove ${option.text}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Add a book</Label>
              <BookPicker onSelect={handleAddBookOption} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="poll-end">End date (optional)</Label>
              <Input
                id="poll-end"
                type="date"
                value={newPoll.endDate}
                onChange={(e) =>
                  setNewPoll({ ...newPoll, endDate: e.target.value })
                }
              />
            </div>

            {error && (
              <p className="font-ui text-sm text-ns-accent" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreatingPoll(false);
                setError(null);
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePoll}
              disabled={isSaving || newPoll.options.length < 2}
            >
              {isSaving ? "Creating…" : "Open the vote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* adopt winner confirm */}
      <ConfirmDialog
        open={adoptTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAdoptTarget(null);
        }}
        title="Adopt the winning book?"
        description={
          adoptTarget
            ? `"${adoptTarget.book.volumeInfo.title}" becomes the club's current book and this vote closes. Members' chapter progress and the reading schedule are not reset — update the pace from the Reading pace section.`
            : ""
        }
        confirmLabel={isAdopting ? "Adopting…" : "Adopt winner"}
        onConfirm={handleAdoptWinner}
        isLoading={isAdopting}
      />
    </div>
  );
};

export default NextBookSection;
