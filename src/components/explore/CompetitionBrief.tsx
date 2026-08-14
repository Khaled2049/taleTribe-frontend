import type { ICompetition } from "@/types/ICompetition";

export interface CompetitionBriefProps {
  competition: ICompetition;
}

/**
 * `rules` and `evaluationCriteria` flow from Firestore into `ICompetition`
 * already, but nothing renders them today — reviving real, if often absent,
 * data rather than the mock's fabricated scoring-rubric UI.
 */
export function CompetitionBrief({ competition }: CompetitionBriefProps) {
  return (
    <div className="flex flex-col gap-9">
      <p className="font-body text-[18px] leading-[1.68] text-ns-ink-secondary max-w-[68ch]">
        {competition.description}
      </p>

      {competition.rules && competition.rules.length > 0 && (
        <div className="pt-9 border-t border-ns-border">
          <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-ns-ink-muted mb-5">
            The rules
          </p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3.5">
            {competition.rules.map((rule, i) => (
              <li
                key={i}
                className="flex gap-3 pb-3.5 border-b border-ns-border"
              >
                <span className="font-heading text-xl text-ns-ink-muted w-[22px] shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-body text-[17px] leading-[1.5] text-ns-ink-secondary">
                  {rule}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {competition.evaluationCriteria && (
        <div className="pt-9 border-t border-ns-border">
          <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-ns-ink-muted mb-3">
            Evaluation
          </p>
          <p className="font-body text-[17px] leading-[1.6] text-ns-ink-secondary max-w-[64ch]">
            {competition.evaluationCriteria}
          </p>
        </div>
      )}
    </div>
  );
}

export default CompetitionBrief;
