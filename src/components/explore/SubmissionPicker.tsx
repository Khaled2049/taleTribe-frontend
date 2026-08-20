import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, FileText, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queryKeys } from "@/hooks/queries/queryKeys";
import { formatMinorUnits, formatTokenAmount } from "@/lib/money";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import {
  TALE_SYMBOL,
  type ITokenAmount,
  type MinorUnits,
} from "@/types/IToken";

interface SubmissionPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onPick: (storyId: string) => void;
  isSubmitting: boolean;
  /** Present only when entering this competition costs TALE. */
  entryFee?: ITokenAmount | null;
  /** The viewer's current TALE balance; undefined while loading. */
  balance?: MinorUnits;
}

/**
 * Choose one of your own stories to enter.
 *
 * Only published stories are offered. `firestore.rules` exposes a story to
 * others only when `isPublished == true`, so an unpublished entry would be
 * invisible to every voter — the server rejects it too, but explaining it here
 * is better than surfacing a 422.
 */
const SubmissionPicker: React.FC<SubmissionPickerProps> = ({
  open,
  onOpenChange,
  userId,
  onPick,
  isSubmitting,
  entryFee,
  balance,
}) => {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const { data: stories, isLoading } = useQuery({
    queryKey: [...queryKeys.user.stories(userId), "picker"] as const,
    queryFn: () => storyWorkspaceRepo.getUserStories(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) setSelectedStoryId(null);
  }, [open]);

  const { published, unpublishedCount } = useMemo(() => {
    const all = stories ?? [];
    return {
      published: all.filter((story) => story.isPublished),
      unpublishedCount: all.filter((story) => !story.isPublished).length,
    };
  }, [stories]);

  const selectedStory = published.find((story) => story.id === selectedStoryId);
  const insufficientBalance =
    entryFee &&
    balance !== undefined &&
    BigInt(balance) < BigInt(entryFee.amount);
  const balanceAfter =
    entryFee && balance !== undefined && !insufficientBalance
      ? ((BigInt(balance) - BigInt(entryFee.amount)).toString() as MinorUnits)
      : null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSelectedStoryId(null);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 gap-0">
        <DialogHeader className="border-b border-ns-border px-6 pt-7 pb-5 sm:px-8">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.2em] text-ns-accent">
            Competition entry
          </p>
          <DialogTitle className="font-heading text-[32px] font-light leading-none mt-2">
            Choose your entry
          </DialogTitle>
          <DialogDescription className="font-body text-[16px] leading-relaxed max-w-[58ch] mt-2">
            Choose one published story to put forward. You can withdraw and
            change it until submissions close.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="px-6 py-8 sm:px-8 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-[12px] bg-ns-surface"
              />
            ))}
          </div>
        ) : published.length === 0 ? (
          <div className="px-6 py-12 sm:px-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ns-accent-subtle text-ns-accent">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-[28px] leading-none text-ns-ink mt-5">
              No published stories to enter
            </h3>
            <p className="font-body text-[16px] leading-relaxed text-ns-ink-secondary max-w-[42ch] mx-auto mt-3">
              Publish a story first, then return here to put it forward for the
              competition.
            </p>
            {unpublishedCount > 0 && (
              <p className="font-body text-sm text-ns-ink-muted mt-4">
                You have {unpublishedCount} unpublished{" "}
                {unpublishedCount === 1 ? "story" : "stories"}. Voters need to
                be able to read your entry.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3 sm:px-8">
              <p className="font-ui text-[11px] uppercase tracking-[0.16em] text-ns-ink-muted">
                Eligible stories
              </p>
              <span className="font-ui text-[12px] text-ns-ink-muted tabular-nums">
                {published.length} available
              </span>
            </div>

            <ul className="max-h-[46vh] overflow-y-auto px-6 pb-5 sm:px-8 space-y-2">
              {published.map((story) => {
                const selected = story.id === selectedStoryId;
                return (
                  <li key={story.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedStoryId(story.id)}
                      aria-pressed={selected}
                      disabled={isSubmitting}
                      className={`group flex w-full items-start gap-4 rounded-[12px] border p-4 text-left transition-all disabled:opacity-50 ${
                        selected
                          ? "border-ns-accent bg-ns-accent-subtle"
                          : "border-ns-border bg-ns-elevated hover:border-ns-border-strong hover:bg-ns-surface"
                      }`}
                    >
                      <div className="flex h-11 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-ns-border bg-ns-surface text-ns-ink-muted">
                        {story.thumbnailUrl || story.coverImageUrl ? (
                          <img
                            src={story.thumbnailUrl ?? story.coverImageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-[21px] leading-tight text-ns-ink">
                          {story.title}
                        </p>
                        <p className="font-ui text-[10px] uppercase tracking-[0.14em] text-ns-ink-muted mt-1">
                          {story.category || "Story"}
                          {story.wordCount
                            ? ` · ${story.wordCount.toLocaleString()} words`
                            : ""}
                        </p>
                        {story.description && (
                          <p className="font-body text-sm leading-relaxed text-ns-ink-secondary line-clamp-2 mt-2">
                            {story.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          selected
                            ? "border-ns-accent bg-ns-accent text-ns-bg"
                            : "border-ns-border-strong text-transparent group-hover:border-ns-ink-muted"
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-3 border-t border-ns-border bg-ns-surface px-6 py-4 sm:px-8">
              {entryFee ? (
                <div
                  aria-live="polite"
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-[12px] text-ns-ink-secondary"
                >
                  <span>
                    Entry fee{" "}
                    <strong className="font-semibold text-ns-ink">
                      {formatTokenAmount(entryFee)}
                    </strong>
                  </span>
                  <span className="hidden text-ns-ink-muted sm:inline">→</span>
                  <span>
                    Balance after{" "}
                    <strong
                      className={`font-semibold ${
                        insufficientBalance
                          ? "text-ns-destructive"
                          : "text-ns-ink"
                      }`}
                    >
                      {balance === undefined
                        ? "Checking…"
                        : insufficientBalance
                          ? "Insufficient TALE"
                          : `${formatMinorUnits(balanceAfter!)} ${TALE_SYMBOL}`}
                    </strong>
                  </span>
                </div>
              ) : (
                <p className="flex items-center gap-2 font-body text-xs leading-relaxed text-ns-ink-muted">
                  <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
                  Your story remains yours. You can change your entry before the
                  deadline.
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                {entryFee && (
                  <p className="flex items-center gap-2 font-body text-xs leading-relaxed text-ns-ink-muted">
                    <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
                    Refunded if you withdraw before the deadline.
                  </p>
                )}
                <Button
                  onClick={() => selectedStory && onPick(selectedStory.id)}
                  disabled={!selectedStory || isSubmitting}
                  className="shrink-0 bg-ns-ink text-ns-bg hover:opacity-90"
                >
                  {isSubmitting
                    ? "Entering…"
                    : selectedStory
                      ? "Enter with this story"
                      : "Choose a story"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubmissionPicker;
