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

export interface MoveTarget {
  line: PlotLine;
  event: PlotEvent;
}

interface MoveEventDialogProps {
  target: MoveTarget | null;
  onClose: () => void;
  lines: PlotLine[];
  onMoveToLine: (line: PlotLine, event: PlotEvent, toLineId: string) => void;
}

const fieldClass =
  "w-full p-2 rounded-ns border border-ns-border bg-ns-surface font-ui text-sm text-ns-ink focus:outline-none focus:ring-2 focus:ring-ns-accent";

/** The non-drag way to move an event to another plot line. */
export const MoveEventDialog: React.FC<MoveEventDialogProps> = ({
  target,
  onClose,
  lines,
  onMoveToLine,
}) => {
  const [lineId, setLineId] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);
  const key = target ? target.event.id : null;
  if (key !== openFor) {
    setOpenFor(key);
    setLineId(target?.line.id ?? "");
  }

  if (!target) return null;
  const name = target.event.name || "Untitled event";
  const save = () => {
    if (lineId && lineId !== target.line.id) {
      onMoveToLine(target.line, target.event, lineId);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-ns-elevated border-ns-border">
        <DialogHeader>
          <DialogTitle className="font-heading italic text-xl text-ns-ink">
            Move to plot line
          </DialogTitle>
          <DialogDescription className="font-ui text-sm text-ns-ink-secondary">
            {`Move “${name}” to the end of another plot line. Its chapter and links stay as they are.`}
          </DialogDescription>
        </DialogHeader>
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
            Move
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
