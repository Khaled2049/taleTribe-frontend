import React, { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  IChapterSchedule,
  IClub,
  IReadingProgress,
  IReadingSchedule,
} from "@/types/IClub";
import { bookClubRepo } from "../bookClubRepo";
import { useAuthContext } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queries/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReadingPaceSectionProps {
  club: IClub;
  isCreator: boolean;
  isMember: boolean;
  progress: IReadingProgress[];
  userCurrentChapter: number;
  membersById: Map<string, string>;
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const pacingSentence = (schedule: IReadingSchedule) => {
  const started = new Date(schedule.startDate) <= new Date();
  const start = `${started ? "started" : "starts"} ${formatDate(schedule.startDate)}`;
  if (schedule.pacing.type === "chapters-per-week") {
    const n = schedule.pacing.value;
    return `${n} chapter${n !== 1 ? "s" : ""} a week · ${start}`;
  }
  if (schedule.pacing.type === "chapters-per-days") {
    const n = schedule.pacing.value;
    return `a chapter every ${n} day${n !== 1 ? "s" : ""} · ${start}`;
  }
  return `custom pace · ${start}`;
};

const MemberDot = ({
  username,
  isViewer,
}: {
  username: string;
  isViewer: boolean;
}) => (
  <span
    title={username}
    className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-ui text-[10px] font-semibold -ml-1.5 first:ml-0 border ${
      isViewer
        ? "bg-ns-accent text-white border-ns-accent z-10"
        : "bg-ns-surface text-ns-ink-secondary border-ns-border"
    }`}
  >
    {username.charAt(0).toUpperCase()}
  </span>
);

/**
 * One timeline for both the reading schedule and where every member is.
 * Replaces the old separate schedule card, progress tracker, and progress
 * modal.
 */
const ReadingPaceSection: React.FC<ReadingPaceSectionProps> = ({
  club,
  isCreator,
  isMember,
  progress,
  userCurrentChapter,
  membersById,
}) => {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const schedule = club.readingSchedule;

  const totalChapters =
    schedule?.totalChapters ??
    club.bookOfTheMonth?.totalChapters ??
    Math.max(0, ...progress.map((p) => p.currentChapter));

  // --- inline "you are here" stepper -------------------------------------
  const [chapterDraft, setChapterDraft] = useState(userCurrentChapter);
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  useEffect(() => {
    setChapterDraft(userCurrentChapter);
  }, [userCurrentChapter]);

  const clampChapter = (n: number) =>
    Math.max(0, totalChapters > 0 ? Math.min(n, totalChapters) : n);

  const handleSaveProgress = async () => {
    if (!user) return;
    setIsSavingProgress(true);
    try {
      const ownNotes = progress.find((p) => p.userId === user.uid)?.notes;
      const saved = await bookClubRepo.updateReadingProgress(
        club.id,
        user.uid,
        chapterDraft,
        ownNotes ?? undefined,
      );
      // Without this the viewer's own dot and Save button wait for the next
      // poll, up to 15 seconds after their write already succeeded.
      queryClient.setQueryData<IReadingProgress[]>(
        queryKeys.bookClubs.progress(club.id),
        (current) => [
          ...(current ?? []).filter((p) => p.userId !== saved.userId),
          saved,
        ],
      );
    } catch (error) {
      console.error("Error updating reading progress:", error);
      setChapterDraft(userCurrentChapter);
    } finally {
      setIsSavingProgress(false);
    }
  };

  // --- schedule editor -----------------------------------------------------
  const [isEditing, setIsEditing] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [pacingType, setPacingType] = useState<
    "chapters-per-week" | "chapters-per-days" | "custom"
  >("chapters-per-week");
  const [pacingValue, setPacingValue] = useState(2);
  const [editTotalChapters, setEditTotalChapters] = useState(20);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const openEditor = () => {
    if (schedule) {
      setStartDate(schedule.startDate);
      setPacingType(schedule.pacing.type);
      setPacingValue(schedule.pacing.value);
      setEditTotalChapters(schedule.totalChapters || 20);
    } else {
      setStartDate("");
      setPacingType("chapters-per-week");
      setPacingValue(2);
      setEditTotalChapters(club.bookOfTheMonth?.totalChapters || 20);
    }
    setScheduleError(null);
    setIsEditing(true);
  };

  const calculateSchedule = (): IChapterSchedule[] => {
    if (!startDate) return [];

    const start = new Date(startDate);
    const chapters: IChapterSchedule[] = [];
    let currentDate = new Date(start);

    for (let i = 1; i <= editTotalChapters; i++) {
      chapters.push({
        chapterNumber: i,
        scheduledDate: currentDate.toISOString().split("T")[0],
      });

      if (pacingType === "chapters-per-week") {
        const daysPerChapter = 7 / pacingValue;
        currentDate = new Date(
          currentDate.getTime() + daysPerChapter * 24 * 60 * 60 * 1000,
        );
      } else if (pacingType === "chapters-per-days") {
        currentDate = new Date(
          currentDate.getTime() + pacingValue * 24 * 60 * 60 * 1000,
        );
      } else {
        currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }

    return chapters;
  };

  const handleSaveSchedule = async () => {
    if (!startDate) {
      setScheduleError("Please select a start date");
      return;
    }

    setIsSavingSchedule(true);
    setScheduleError(null);

    try {
      const newSchedule: IReadingSchedule = {
        startDate,
        pacing: { type: pacingType, value: pacingValue },
        chapters: calculateSchedule(),
        totalChapters: editTotalChapters,
      };

      if (schedule) {
        await bookClubRepo.updateReadingSchedule(club.id, newSchedule);
      } else {
        await bookClubRepo.createReadingSchedule(club.id, newSchedule);
      }

      setIsEditing(false);
    } catch (err) {
      console.error("Error saving schedule:", err);
      setScheduleError(
        err instanceof Error ? err.message : "Failed to save schedule",
      );
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // --- timeline data -------------------------------------------------------
  const usernameFor = (p: IReadingProgress) =>
    membersById.get(p.userId) || p.username || "Reader";

  const activeProgress = useMemo(
    () => progress.filter((p) => p.currentChapter > 0),
    [progress],
  );

  const membersOnChapter = useMemo(() => {
    const map = new Map<number, IReadingProgress[]>();
    if (!schedule || schedule.chapters.length === 0) return map;
    const lastChapter =
      schedule.chapters[schedule.chapters.length - 1].chapterNumber;
    for (const p of activeProgress) {
      const key = Math.min(p.currentChapter, lastChapter);
      map.set(key, [...(map.get(key) || []), p]);
    }
    return map;
  }, [schedule, activeProgress]);

  const todayIndex = useMemo(() => {
    if (!schedule) return -1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return schedule.chapters.findIndex((ch) => {
      const d = new Date(ch.scheduledDate);
      d.setHours(0, 0, 0, 0);
      return d.getTime() >= today.getTime();
    });
  }, [schedule]);

  const showStepper = !!user && isMember;
  const hasDraftChange = chapterDraft !== userCurrentChapter;

  return (
    <div>
      {/* header line */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-5">
        {schedule ? (
          <p className="font-body text-sm text-ns-ink-secondary italic">
            {pacingSentence(schedule)}
          </p>
        ) : (
          <p className="font-body text-sm italic text-ns-ink-muted">
            {isCreator
              ? "No reading pace set yet."
              : "The club hasn't set a reading pace yet."}
          </p>
        )}
        {isCreator && (
          <button
            type="button"
            onClick={openEditor}
            className="font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-ns-ink-muted hover:text-ns-accent transition-colors"
          >
            {schedule ? "Edit schedule" : "Set the pace →"}
          </button>
        )}
      </div>

      {/* your position */}
      {showStepper && (
        <div className="flex flex-wrap items-center gap-3 mb-6 font-ui text-sm text-ns-ink">
          <span className="text-ns-ink-secondary">You're on chapter</span>
          <span className="inline-flex items-center border border-ns-border rounded-full">
            <button
              type="button"
              onClick={() => setChapterDraft((c) => clampChapter(c - 1))}
              disabled={isSavingProgress || chapterDraft <= 0}
              className="p-1.5 text-ns-ink-muted hover:text-ns-accent disabled:opacity-40 transition-colors"
              aria-label="Previous chapter"
            >
              <Minus size={13} />
            </button>
            <span className="min-w-[2ch] text-center font-semibold tabular-nums">
              {chapterDraft}
            </span>
            <button
              type="button"
              onClick={() => setChapterDraft((c) => clampChapter(c + 1))}
              disabled={
                isSavingProgress ||
                (totalChapters > 0 && chapterDraft >= totalChapters)
              }
              className="p-1.5 text-ns-ink-muted hover:text-ns-accent disabled:opacity-40 transition-colors"
              aria-label="Next chapter"
            >
              <Plus size={13} />
            </button>
          </span>
          {totalChapters > 0 && (
            <span className="text-ns-ink-muted">of {totalChapters}</span>
          )}
          {hasDraftChange && (
            <button
              type="button"
              onClick={handleSaveProgress}
              disabled={isSavingProgress}
              className="font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-ns-accent hover:opacity-80 disabled:opacity-50 transition-opacity"
            >
              {isSavingProgress ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      )}
      {!user && (
        <p className="font-body text-sm italic text-ns-ink-muted mb-6">
          Sign in to track your reading progress.
        </p>
      )}

      {/* timeline */}
      {schedule && schedule.chapters.length > 0 ? (
        <div className="max-h-96 overflow-y-auto pr-1">
          {schedule.chapters.map((chapter, index) => {
            const readers = membersOnChapter.get(chapter.chapterNumber) || [];
            const isPast = todayIndex === -1 || index < todayIndex;
            return (
              <React.Fragment key={chapter.chapterNumber}>
                {index === todayIndex && index > 0 && (
                  <div
                    className="flex items-center gap-3 py-1.5 text-ns-accent"
                    aria-label="Today"
                  >
                    <span className="flex-1 h-px bg-ns-accent/30" />
                    <span className="font-ui text-[10px] uppercase tracking-[0.2em]">
                      · today ·
                    </span>
                    <span className="flex-1 h-px bg-ns-accent/30" />
                  </div>
                )}
                <div
                  className={`grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 py-2 border-t border-ns-border first:border-t-0 ${
                    isPast && readers.length === 0 ? "opacity-50" : ""
                  }`}
                >
                  <span className="font-heading text-2xl tabular-nums text-ns-ink/[0.18] select-none leading-none">
                    {String(chapter.chapterNumber).padStart(2, "0")}
                  </span>
                  <span className="font-ui text-xs text-ns-ink-muted">
                    {chapter.chapterTitle && (
                      <span className="text-ns-ink-secondary">
                        {chapter.chapterTitle} ·{" "}
                      </span>
                    )}
                    {formatDate(chapter.scheduledDate)}
                  </span>
                  <span className="flex items-center">
                    {readers.map((p) => (
                      <MemberDot
                        key={p.userId}
                        username={usernameFor(p)}
                        isViewer={p.userId === user?.uid}
                      />
                    ))}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        activeProgress.length > 0 && (
          <div>
            <p className="font-ui text-[10px] font-semibold tracking-[0.18em] uppercase text-ns-ink-muted mb-3">
              Where everyone is
            </p>
            <div className="space-y-2.5">
              {activeProgress.map((p) => {
                const denominator = Math.max(totalChapters, p.currentChapter, 1);
                const pct = Math.min(
                  (p.currentChapter / denominator) * 100,
                  100,
                );
                const isViewer = p.userId === user?.uid;
                return (
                  <div
                    key={p.userId}
                    className="grid grid-cols-[7rem_1fr_auto] items-center gap-3"
                  >
                    <span
                      className={`font-ui text-xs truncate ${
                        isViewer
                          ? "text-ns-accent font-semibold"
                          : "text-ns-ink-secondary"
                      }`}
                    >
                      {usernameFor(p)}
                    </span>
                    <span className="h-1 bg-ns-border rounded-full overflow-hidden">
                      <span
                        className={`block h-full rounded-full ${
                          isViewer ? "bg-ns-accent" : "bg-ns-ink-muted"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="font-ui text-xs text-ns-ink-muted tabular-nums">
                      Ch. {p.currentChapter}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* schedule editor */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-ns-ink">
              {schedule ? "Edit the reading pace" : "Set the reading pace"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pace-start">Start date</Label>
                <Input
                  id="pace-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pace-total">Total chapters</Label>
                <Input
                  id="pace-total"
                  type="number"
                  min="1"
                  value={editTotalChapters}
                  onChange={(e) =>
                    setEditTotalChapters(
                      Math.max(1, parseInt(e.target.value) || 1),
                    )
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pacing</Label>
              <Select
                value={pacingType}
                onValueChange={(value) =>
                  setPacingType(value as typeof pacingType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chapters-per-week">
                    Chapters per week
                  </SelectItem>
                  <SelectItem value="chapters-per-days">
                    Days per chapter
                  </SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pace-value">
                {pacingType === "chapters-per-week"
                  ? "Chapters per week"
                  : pacingType === "chapters-per-days"
                    ? "Days per chapter"
                    : "Weeks per chapter"}
              </Label>
              <Input
                id="pace-value"
                type="number"
                min="1"
                value={pacingValue}
                onChange={(e) =>
                  setPacingValue(Math.max(1, parseFloat(e.target.value) || 1))
                }
              />
            </div>

            {scheduleError && (
              <p className="font-ui text-sm text-ns-accent" role="alert">
                {scheduleError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={isSavingSchedule}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSchedule} disabled={isSavingSchedule}>
              {isSavingSchedule ? "Saving…" : "Save schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReadingPaceSection;
