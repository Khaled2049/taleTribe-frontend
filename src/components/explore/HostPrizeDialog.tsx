import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateCompetition,
  useUpdateCompetition,
} from "@/hooks/queries/useCompetitionQueries";
import { formatMinorUnits, parseTokenInput } from "@/lib/money";
import { TALE_SYMBOL } from "@/types/IToken";
import {
  ICompetition,
  ICompetitionCreateInput,
  ICompetitionUpdate,
} from "@/types/ICompetition";

interface CompetitionFormState {
  title: string;
  description: string;
  category: string;
  /** Whole TALE as typed, e.g. "1000". Converted to minor units on submit. */
  prizeAmount: string;
  startDate: string;
  deadline: string;
  votingDeadline: string;
  maxParticipants: string;
  tags: string;
}

const toDateTimeLocal = (date: Date): string => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

const getInitialFormState = (): CompetitionFormState => {
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  const deadline = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const votingDeadline = new Date(deadline.getTime() + 3 * 24 * 60 * 60 * 1000);

  return {
    title: "",
    description: "",
    category: "",
    prizeAmount: "",
    startDate: toDateTimeLocal(start),
    deadline: toDateTimeLocal(deadline),
    votingDeadline: toDateTimeLocal(votingDeadline),
    maxParticipants: "",
    tags: "",
  };
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const mapCompetitionToForm = (
  competition: ICompetition,
): CompetitionFormState => {
  return {
    title: competition.title,
    description: competition.description,
    category: competition.category,
    // Display only — the prize is immutable once escrow is funded, so the
    // field is rendered read-only while editing.
    prizeAmount: competition.prizePool
      ? formatMinorUnits(
          competition.prizePool.amount,
          competition.prizePool.decimals,
        )
      : String(competition.prizeAmount),
    startDate: toDateTimeLocal(competition.startDate),
    deadline: toDateTimeLocal(competition.deadline),
    votingDeadline: competition.votingDeadline
      ? toDateTimeLocal(competition.votingDeadline)
      : "",
    maxParticipants: competition.maxParticipants
      ? String(competition.maxParticipants)
      : "",
    tags: competition.tags.join(", "),
  };
};

const parseTags = (raw: string): string[] =>
  raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

export interface HostPrizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCompetition: ICompetition | null;
}

export function HostPrizeDialog({
  open,
  onOpenChange,
  editingCompetition,
}: HostPrizeDialogProps) {
  const { user } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<CompetitionFormState>(
    getInitialFormState(),
  );

  const createCompetition = useCreateCompetition();
  const updateCompetition = useUpdateCompetition();
  const saving = createCompetition.isPending || updateCompetition.isPending;

  // Re-seed the form every time the dialog opens, rather than on every
  // `editingCompetition` change, so editing doesn't clobber in-progress typing
  // if the underlying competition list happens to refetch while open.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setFormState(
      editingCompetition
        ? mapCompetitionToForm(editingCompetition)
        : getInitialFormState(),
    );
  }, [open, editingCompetition]);

  const handleFormChange = (
    field: keyof CompetitionFormState,
    value: string,
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!user) {
      setError("You must be logged in to manage competitions.");
      return;
    }

    setError(null);

    if (editingCompetition) {
      // The prize is deliberately absent — it is immutable once escrow is
      // funded, and the server rejects any attempt to change it.
      const updates: ICompetitionUpdate = {
        title: formState.title,
        description: formState.description,
        category: formState.category,
        tags: parseTags(formState.tags),
        maxParticipants: formState.maxParticipants
          ? Number(formState.maxParticipants)
          : null,
        startDate: new Date(formState.startDate),
        deadline: new Date(formState.deadline),
        ...(formState.votingDeadline
          ? { votingDeadline: new Date(formState.votingDeadline) }
          : {}),
      };

      updateCompetition.mutate(
        { competitionId: editingCompetition.id, updates },
        {
          onSuccess: () => {
            toast.success("Competition updated");
            onOpenChange(false);
          },
          onError: (err) =>
            setError(getErrorMessage(err, "Failed to save competition.")),
        },
      );
      return;
    }

    // Parse the prize before hitting the network so a typo is caught here
    // rather than as a 400 — the server still validates it regardless.
    let prizeAmount: ICompetitionCreateInput["prizeAmount"];
    try {
      prizeAmount = parseTokenInput(formState.prizeAmount);
    } catch (err) {
      setError(getErrorMessage(err, "Enter a valid prize amount."));
      return;
    }

    createCompetition.mutate(
      {
        title: formState.title,
        description: formState.description,
        category: formState.category,
        tags: parseTags(formState.tags),
        maxParticipants: formState.maxParticipants
          ? Number(formState.maxParticipants)
          : null,
        startDate: new Date(formState.startDate),
        deadline: new Date(formState.deadline),
        votingDeadline: new Date(formState.votingDeadline),
        prizeAmount,
        creatorName: user.username || user.email || "Unknown user",
      },
      {
        onSuccess: () => {
          toast.success(
            `Competition created — ${formState.prizeAmount} ${TALE_SYMBOL} moved into escrow`,
          );
          onOpenChange(false);
        },
        onError: (err) =>
          setError(getErrorMessage(err, "Failed to create competition.")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-light">
            {editingCompetition ? "Edit Competition" : "Host a competition"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-ns border border-ns-destructive/30 bg-ns-destructive/10 p-3 text-sm text-ns-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted">
              Title
            </label>
            <input
              value={formState.title}
              onChange={(e) => handleFormChange("title", e.target.value)}
              className="w-full bg-transparent border border-ns-border rounded-ns px-3 py-2 text-sm text-ns-ink"
              placeholder="Competition title"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted">
              Category
            </label>
            <input
              value={formState.category}
              onChange={(e) => handleFormChange("category", e.target.value)}
              className="w-full bg-transparent border border-ns-border rounded-ns px-3 py-2 text-sm text-ns-ink"
              placeholder="Fantasy, Horror, Short Story..."
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted">
              Description
            </label>
            <textarea
              value={formState.description}
              onChange={(e) => handleFormChange("description", e.target.value)}
              className="w-full bg-transparent border border-ns-border rounded-ns px-3 py-2 text-sm min-h-[96px] text-ns-ink"
              placeholder="Describe the competition and entry expectations"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted">
              Tags
            </label>
            <input
              value={formState.tags}
              onChange={(e) => handleFormChange("tags", e.target.value)}
              className="w-full bg-transparent border border-ns-border rounded-ns px-3 py-2 text-sm text-ns-ink"
              placeholder="Fantasy, Lore, Adventure"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted">
              Prize Pool ({TALE_SYMBOL})
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formState.prizeAmount}
              onChange={(e) => handleFormChange("prizeAmount", e.target.value)}
              disabled={!!editingCompetition}
              className="w-full bg-transparent border border-ns-border rounded-ns px-3 py-2 text-sm disabled:opacity-50 text-ns-ink"
              placeholder="1000"
            />
            <p className="font-ui text-[10px] text-ns-ink-muted">
              {editingCompetition
                ? "The prize can't be changed once it's escrowed — cancel and recreate instead."
                : "Moved from your balance into escrow when the competition is created. Winner takes all."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted">
              Start Date
            </label>
            <input
              type="datetime-local"
              value={formState.startDate}
              onChange={(e) => handleFormChange("startDate", e.target.value)}
              className="w-full bg-transparent border border-ns-border rounded-ns px-3 py-2 text-sm text-ns-ink"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted">
              Submissions Close
            </label>
            <input
              type="datetime-local"
              value={formState.deadline}
              onChange={(e) => handleFormChange("deadline", e.target.value)}
              className="w-full bg-transparent border border-ns-border rounded-ns px-3 py-2 text-sm text-ns-ink"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted">
              Voting Closes
            </label>
            <input
              type="datetime-local"
              value={formState.votingDeadline}
              onChange={(e) => handleFormChange("votingDeadline", e.target.value)}
              className="w-full bg-transparent border border-ns-border rounded-ns px-3 py-2 text-sm text-ns-ink"
            />
            <p className="font-ui text-[10px] text-ns-ink-muted">
              At least an hour after submissions close.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-ui text-[10px] tracking-[0.14em] uppercase text-ns-ink-muted">
              Max Participants (optional)
            </label>
            <input
              type="number"
              min="1"
              value={formState.maxParticipants}
              onChange={(e) => handleFormChange("maxParticipants", e.target.value)}
              className="w-full bg-transparent border border-ns-border rounded-ns px-3 py-2 text-sm text-ns-ink"
              placeholder="1000"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? "Saving..."
              : editingCompetition
                ? "Save Changes"
                : "Create Competition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HostPrizeDialog;
