import React, { useState } from "react";
import type { PlotEvent, PlotLine } from "@/types/IPlot";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChapterSelect } from "../ChapterSelect";
import type { ChapterOption } from "../plotChapters";

export type MoveTarget =
  | { mode: "chapter"; line: PlotLine; event: PlotEvent }
  | { mode: "line"; line: PlotLine; event: PlotEvent };

interface MoveEventDialogProps {
  target: MoveTarget | null;
  onClose: () => void;
  chapters: ChapterOption[];
  lines: PlotLine[];
  onAssignChapter: (
    line: PlotLine,
    event: PlotEvent,
    chapterId: string | null,
  ) => void;
  onMoveToLine: (line: PlotLine, event: PlotEvent, toLineId: string) => void;
}

const fieldClass =
  "w-full p-2 rounded-ns border border-ns-border bg-ns-surface font-ui text-sm text-ns-ink focus:outline-none focus:ring-2 focus:ring-ns-accent";

/** The non-drag way to move an event: pick a chapter, or a plot line. */
export const MoveEventDialog: React.FC<MoveEventDialogProps> = ({
  target,
  onClose,
  chapters,
  lines,
  onAssignChapter,
  onMoveToLine,
}) => {
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [lineId, setLineId] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);
  const key = target ? `${target.mode}:${target.event.id}` : null;
  if (key !== openFor) {
    setOpenFor(key);
    setChapterId(target?.event.chapterId ?? null);
    setLineId(target?.line.id ?? "");
  }

  if (!target) return null;
  const name = target.event.name || "Untitled event";
  const save = () => {
    if (target.mode === "chapter") {
      onAssignChapter(target.line, target.event, chapterId);
    } else if (lineId && lineId !== target.line.id) {
      onMoveToLine(target.line, target.event, lineId);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-ns-elevated border-ns-border">
        <DialogHeader>
          <DialogTitle className="font-heading italic text-xl text-ns-ink">
            {target.mode === "chapter" ? "Assign chapter" : "Move to plot line"}
          </DialogTitle>
          <DialogDescription className="font-ui text-sm text-ns-ink-secondary">
            {target.mode === "chapter"
              ? `Which chapter is “${name}” planned for? It goes to the end of that chapter.`
              : `Move “${name}” to the end of another plot line. Its chapter and links stay as they are.`}
          </DialogDescription>
        </DialogHeader>
        {target.mode === "chapter" ? (
          <ChapterSelect
            aria-label="Chapter"
            chapters={chapters}
            value={chapterId}
            onChange={setChapterId}
            className={fieldClass}
          />
        ) : (
          <select
            aria-label="Plot line"
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className={fieldClass}
          >
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name || "Untitled plot line"}
                {line.id === target.line.id ? " (current)" : ""}
              </option>
            ))}
          </select>
        )}
        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-ns border border-ns-border font-ui text-sm text-ns-ink-secondary hover:bg-ns-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="px-4 py-2 rounded-ns bg-ns-accent font-ui text-sm font-medium text-white hover:bg-ns-accent-hover"
          >
            {target.mode === "chapter" ? "Assign" : "Move"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
