import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export interface CompetitionsEmptyStateProps {
  /** "none" — there are no competitions at all. "search" — the query matched none. */
  variant: "none" | "search";
  canHost: boolean;
  onClearSearch?: () => void;
}

export function CompetitionsEmptyState({
  variant,
  canHost,
  onClearSearch,
}: CompetitionsEmptyStateProps) {
  const isSearch = variant === "search";

  return (
    <div className="flex flex-col items-center gap-[18px] px-12 py-14 text-center">
      <div
        className="h-[140px] w-[104px] rounded-ns border border-ns-border bg-ns-elevated"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(212,169,74,.06) 0 1px, transparent 1px 13px)",
        }}
      />
      <h2 className="font-heading text-[40px] leading-[1.05] text-ns-ink">
        {isSearch
          ? "No competitions match your search"
          : "No competitions just yet"}
      </h2>
      <p className="font-body text-[17px] leading-[1.55] max-w-[36ch] text-ns-ink-secondary">
        {isSearch
          ? "Try a different search, or clear it to see everything."
          : "There's nothing to enter right now. Check back soon, or start a competition of your own and let the tribe write to it."}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {isSearch ? (
          <Button variant="outline" onClick={onClearSearch}>
            Clear search
          </Button>
        ) : (
          <>
            {canHost && (
              <Link to="/competitions/new">
                <Button className="bg-ns-ink text-ns-bg hover:opacity-90">
                  Host a competition
                </Button>
              </Link>
            )}
            {/* Nothing to browse, so the explainer is the one useful thing here. */}
            <Link
              to="/competitions/how-it-works"
              className="font-ui text-[13px] font-semibold text-ns-accent hover:text-ns-accent-hover transition-colors"
            >
              See how competitions work
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default CompetitionsEmptyState;
