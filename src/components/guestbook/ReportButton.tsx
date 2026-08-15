import React, { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ReportButtonProps {
  onReport: (reason?: string) => Promise<void>;
  hasReported?: boolean;
  disabled?: boolean;
  /** Hide the built-in trigger button and drive the dialog externally. */
  showTrigger?: boolean;
  /** Controlled open state (used with showTrigger={false}). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const ReportButton: React.FC<ReportButtonProps> = ({
  onReport,
  hasReported = false,
  disabled = false,
  showTrigger = true,
  open,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleReport = async () => {
    setIsLoading(true);
    try {
      await onReport(reason.trim() || undefined);
      setIsOpen(false);
      setReason("");
    } catch (error) {
      console.error("Error reporting post:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (hasReported) {
    if (!showTrigger) return null;
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="text-ns-ink-muted"
      >
        <Flag size={14} className="mr-1" />
        <span className="text-xs">Reported</span>
      </Button>
    );
  }

  return (
    <>
      {showTrigger && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className="text-ns-ink-muted hover:text-ns-destructive"
        >
          <Flag size={14} className="mr-1" />
          <span className="text-xs">Report</span>
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to report this post? The first report will
              automatically delete the post. Please provide a reason (optional).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for reporting (optional)..."
              className="min-h-[100px] resize-none"
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setReason("");
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReport}
              disabled={isLoading}
            >
              {isLoading ? "Reporting..." : "Report Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportButton;
