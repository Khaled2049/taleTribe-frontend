import type { ICompetition } from "@/types/ICompetition";

export interface CompetitionKeyDatesCardProps {
  competition: ICompetition;
}

interface Milestone {
  label: string;
  date: Date;
  estimated?: boolean;
  done: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CompetitionKeyDatesCard({ competition }: CompetitionKeyDatesCardProps) {
  const now = Date.now();
  const milestones: Milestone[] = [
    {
      label: "Entries close",
      date: competition.deadline,
      done: now >= competition.deadline.getTime(),
    },
  ];

  if (competition.votingDeadline) {
    milestones.push({
      label: "Voting closes",
      date: competition.votingDeadline,
      done: now >= competition.votingDeadline.getTime(),
    });
  }

  // `settledAt` is only real once settlement has actually run — before that,
  // `votingDeadline` is the best estimate of when results land, labeled as one
  // rather than presented as a firm date.
  if (competition.settledAt) {
    milestones.push({ label: "Results", date: competition.settledAt, done: true });
  } else if (competition.votingDeadline) {
    milestones.push({
      label: "Results (estimated)",
      date: competition.votingDeadline,
      estimated: true,
      done: false,
    });
  }

  return (
    <div className="rounded-[14px] border border-ns-border bg-ns-surface p-[22px] flex flex-col gap-3.5">
      <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted mb-1">
        Key dates
      </p>
      {milestones.map((m, i) => (
        <div key={i} className="flex items-start gap-3">
          <span
            className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${
              m.done ? "bg-ns-ink-muted opacity-60" : "bg-ns-accent"
            }`}
          />
          <div>
            <p
              className={`font-ui text-sm font-semibold ${m.done ? "text-ns-ink-secondary" : "text-ns-ink"}`}
            >
              {m.label}
            </p>
            <p className="font-ui text-[13px] text-ns-ink-muted">
              {formatDate(m.date)}
              {m.estimated ? " (est.)" : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default CompetitionKeyDatesCard;
