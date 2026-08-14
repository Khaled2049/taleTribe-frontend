import { useMemo } from "react";
import { formatMinorUnits } from "@/lib/money";
import type { ICompetition } from "@/types/ICompetition";
import type { ICompetitionSubmission } from "@/types/ICompetitionSubmission";

export interface CompetitionResultsCardProps {
  competition: ICompetition;
  entries: ICompetitionSubmission[];
  currentUserId?: string;
}

const RESULT_ROWS = 3;

/**
 * `competition.results` holds a full ranked array, not just the winner —
 * every entry gets a rank, but only rank 1 ever has `amount > 0` since
 * settlement is winner-take-all. Showing the real top ranks (with their real,
 * mostly-zero payouts) is more honest than only ever showing one line.
 */
export function CompetitionResultsCard({
  competition,
  entries,
  currentUserId,
}: CompetitionResultsCardProps) {
  const results = useMemo(() => competition.results ?? [], [competition.results]);

  const winner = useMemo(
    () => results.find((r) => r.rank === 1 && BigInt(r.amount) > 0n),
    [results],
  );

  const topRows = useMemo(
    () => [...results].sort((a, b) => a.rank - b.rank).slice(0, RESULT_ROWS),
    [results],
  );

  const entryFor = (submissionId: string) =>
    entries.find((e) => e.id === submissionId);

  const winnerEntry = winner ? entryFor(winner.submissionId) : undefined;
  const decimals = competition.prizePool?.decimals;
  const symbol = competition.prizePool?.symbol ?? "";

  return (
    <section className="mb-10 rounded-ns-lg border border-ns-border overflow-hidden">
      <div
        className="p-6 border-b border-ns-border"
        style={{
          backgroundImage:
            "repeating-linear-gradient(105deg, rgba(212,169,74,.08) 0 1px, transparent 1px 13px)",
        }}
      >
        <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-ns-ink-muted mb-2">
          Results · {competition.title}
        </p>
        <h2 className="font-heading text-[28px] leading-[1.05] text-ns-ink">
          {winner
            ? `${winnerEntry?.storyTitle ?? "An entry"} won with ${winner.votes} vote${winner.votes === 1 ? "" : "s"}`
            : "No prize awarded"}
        </h2>
        {!winner && (
          <p className="font-body text-sm text-ns-ink-secondary mt-2">
            No entry received a vote, so the prize pool was returned to the
            organiser.
          </p>
        )}
      </div>

      {topRows.length > 0 && (
        <div className="p-6 flex flex-col gap-3.5">
          {topRows.map((result) => {
            const entry = entryFor(result.submissionId);
            const isOwn = result.userId === currentUserId;
            return (
              <div
                key={result.submissionId}
                className={`flex items-center gap-4 rounded-ns px-3 py-2 ${
                  isOwn ? "bg-ns-accent-subtle" : ""
                }`}
              >
                <span
                  className={`font-heading text-2xl w-[22px] shrink-0 ${
                    result.rank === 1
                      ? "text-ns-gold-bright"
                      : isOwn
                        ? "text-ns-accent"
                        : "text-ns-ink-muted"
                  }`}
                >
                  {result.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-body italic text-base text-ns-ink truncate">
                    {entry?.storyTitle ?? result.submissionId}
                  </p>
                  <p className="font-ui text-xs text-ns-ink-muted">
                    {entry?.storyAuthorName ?? "Anonymous"}
                    {isOwn ? " · You" : ""} · {result.votes} vote
                    {result.votes === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="font-ui text-sm font-semibold text-ns-ink shrink-0">
                  {BigInt(result.amount) > 0n
                    ? `+${formatMinorUnits(result.amount, decimals)} ${symbol}`
                    : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {competition.resultsDigest && (
        <p
          className="px-6 pb-5 font-mono text-[10px] text-ns-ink-muted break-all"
          title="SHA-256 of the published results payload"
        >
          digest {competition.resultsDigest}
        </p>
      )}
    </section>
  );
}

export default CompetitionResultsCard;
