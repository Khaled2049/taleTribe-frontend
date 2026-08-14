import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CompetitionLedgerRow } from "./CompetitionLedgerRow";
import { LEDGER_GRID } from "@/lib/competitionLedger";
import { pageItems } from "@/lib/pagination";
import { CompetitionsEmptyState } from "./CompetitionsEmptyState";
import { LedgerStatusLegend } from "./LedgerStatusLegend";
import {
  useCompetitionsQuery,
  useMyDraftsQuery,
} from "@/hooks/queries/useCompetitionQueries";
import { useNow } from "@/hooks/useCountdown";
import { getHostName } from "@/lib/competitionListing";
import { ICompetition } from "@/types/ICompetition";

const PAGE_SIZE = 8;

type CompetitionTab = "competitions" | "drafts";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const matchesQuery = (competition: ICompetition, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    competition.title.toLowerCase().includes(q) ||
    competition.description.toLowerCase().includes(q) ||
    competition.category.toLowerCase().includes(q) ||
    getHostName(competition).toLowerCase().includes(q) ||
    competition.tags.some((tag) => tag.toLowerCase().includes(q))
  );
};

const Competitions: React.FC = () => {
  const { user } = useAuthContext();
  const canHost = !!user?.isAdmin;
  const now = useNow();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const activeTab: CompetitionTab =
    canHost && searchParams.get("tab") === "drafts" ? "drafts" : "competitions";
  const draftPage = Math.max(1, Number(searchParams.get("draftPage")) || 1);

  const updateParams = (patch: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      return next;
    });
  };

  const [error, setError] = useState<string | null>(null);

  const {
    data: competitionsData,
    isLoading: loading,
    error: loadError,
  } = useCompetitionsQuery(user?.uid);
  const competitions = useMemo<ICompetition[]>(
    () => competitionsData ?? [],
    [competitionsData],
  );

  // Only the host's own, and only readable by them — firestore.rules denies a
  // draft to everyone else.
  const {
    data: draftsData,
    isLoading: draftsLoading,
    error: draftsError,
  } = useMyDraftsQuery(canHost ? user?.uid : undefined);
  const drafts = draftsData ?? [];

  const displayedError =
    error ??
    (loadError
      ? getErrorMessage(loadError, "Failed to load competitions.")
      : draftsError
        ? getErrorMessage(draftsError, "Failed to load your drafts.")
        : null);

  // Cmd+K / Ctrl+K focuses search, matching the handoff's stated shortcut.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searched = useMemo(
    () => competitions.filter((c) => matchesQuery(c, query)),
    [competitions, query],
  );

  // No filtering: the ledger lists every competition, in every phase. Search
  // narrows it; the list stays ordered by submissions-close date.
  const sorted = useMemo(() => {
    const list = [...searched];
    list.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    return list;
  }, [searched]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Clamped rather than trusted: `?page=` is user-editable, and a search that
  // narrows the results can strand the reader past the end.
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const visible = sorted.slice(firstIndex, firstIndex + PAGE_SIZE);

  const draftTotalPages = Math.max(1, Math.ceil(drafts.length / PAGE_SIZE));
  const currentDraftPage = Math.min(Math.max(1, draftPage), draftTotalPages);
  const firstDraftIndex = (currentDraftPage - 1) * PAGE_SIZE;
  const visibleDrafts = drafts.slice(
    firstDraftIndex,
    firstDraftIndex + PAGE_SIZE,
  );

  const goToPage = (next: number) => {
    // Page 1 is the default, so it stays out of the URL.
    updateParams({ page: next === 1 ? null : String(next) });
    // Otherwise a page change lands the reader mid-list, wherever they had
    // scrolled to reach the control.
    document.getElementById("ledger")?.scrollIntoView({ behavior: "smooth" });
  };

  const goToDraftPage = (next: number) => {
    updateParams({ draftPage: next === 1 ? null : String(next) });
    document.getElementById("drafts")?.scrollIntoView({ behavior: "smooth" });
  };

  const clearSearch = () => {
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="min-h-screen">
      <header className="pt-8 pb-6">
        <h1 className="font-heading font-light text-[2.5rem] lg:text-[3rem] leading-[1] tracking-[-0.02em] text-ns-ink">
          Competitions
        </h1>
        <p className="font-body text-[17px] leading-[1.55] text-ns-ink-secondary max-w-[58ch] mt-3">
          Write to a prompt, enter before the deadline, and let the readers pick
          the winner.
        </p>
      </header>

      {displayedError && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-ns border border-ns-destructive/30 bg-ns-destructive/10 p-3 text-sm text-ns-destructive">
          <span>{displayedError}</span>
          <button
            onClick={() => setError(null)}
            className="text-ns-destructive hover:opacity-80"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 space-y-10">
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[220px] w-[262px] shrink-0" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {canHost && (
            <nav
              aria-label="Competition views"
              className="flex items-end gap-6 border-b border-ns-border"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "competitions"}
                onClick={() => updateParams({ tab: null })}
                className={`relative py-4 font-ui text-[13px] font-semibold transition-colors ${
                  activeTab === "competitions"
                    ? "text-ns-ink"
                    : "text-ns-ink-muted hover:text-ns-ink-secondary"
                }`}
              >
                Explore competitions
                {activeTab === "competitions" && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-ns-accent" />
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "drafts"}
                onClick={() => updateParams({ tab: "drafts", draftPage: null })}
                className={`relative py-4 font-ui text-[13px] font-semibold transition-colors ${
                  activeTab === "drafts"
                    ? "text-ns-ink"
                    : "text-ns-ink-muted hover:text-ns-ink-secondary"
                }`}
              >
                Your drafts
                {drafts.length > 0 && (
                  <span className="ml-1.5 text-[11px] text-ns-ink-muted tabular-nums">
                    {drafts.length}
                  </span>
                )}
                {activeTab === "drafts" && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-ns-accent" />
                )}
              </button>
            </nav>
          )}

          {activeTab === "drafts" ? (
            <section id="drafts" className="py-8 scroll-mt-24">
              <div className="flex items-center gap-4 mb-5 flex-wrap">
                <div>
                  <h2 className="font-heading text-[32px] text-ns-ink">
                    Your drafts
                  </h2>
                  <p className="font-body text-[15px] text-ns-ink-secondary mt-1">
                    Only you can see and edit these unpublished competitions.
                  </p>
                </div>
                <div className="h-px flex-1 min-w-8 bg-ns-border" />
                <Link to="/explore/competitions/new">
                  <Button variant="outline" className="whitespace-nowrap">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    New draft
                  </Button>
                </Link>
              </div>

              {draftsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : drafts.length === 0 ? (
                <div className="flex flex-col items-center gap-4 px-8 py-16 text-center border border-dashed border-ns-border rounded-ns bg-ns-elevated/40">
                  <h3 className="font-heading text-[32px] leading-none text-ns-ink">
                    No drafts to pick up
                  </h3>
                  <p className="font-body text-[16px] leading-[1.55] max-w-[38ch] text-ns-ink-secondary">
                    Start a competition when inspiration strikes. Your
                    unfinished brief will stay here until you are ready to
                    publish it.
                  </p>
                  <Link to="/explore/competitions/new">
                    <Button className="bg-ns-ink text-ns-bg hover:opacity-90">
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Start a competition
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex flex-col border-t border-ns-border">
                    {visibleDrafts.map((draft) => (
                      <Link
                        key={draft.id}
                        to={`/explore/competitions/${draft.id}/edit`}
                        className="group flex items-center justify-between gap-4 py-4 border-b border-ns-border px-1 transition-colors hover:bg-ns-surface-hover"
                      >
                        <div className="min-w-0">
                          <p className="font-heading text-xl text-ns-ink truncate group-hover:text-ns-accent transition-colors">
                            {draft.title || "Untitled competition"}
                          </p>
                          <p className="font-ui text-[11px] uppercase tracking-[0.14em] text-ns-ink-muted mt-1">
                            {draft.category || "Uncategorised"} · Draft
                          </p>
                        </div>
                        <span className="font-ui text-[12px] font-semibold text-ns-ink-secondary shrink-0">
                          Continue editing
                        </span>
                      </Link>
                    ))}
                  </div>

                  <Pagination
                    currentPage={currentDraftPage}
                    totalPages={draftTotalPages}
                    onPageChange={goToDraftPage}
                    label={`Showing ${firstDraftIndex + 1}–${firstDraftIndex + visibleDrafts.length} of ${drafts.length} draft${drafts.length === 1 ? "" : "s"}`}
                    ariaLabel="Draft pagination"
                  />
                </>
              )}
            </section>
          ) : competitions.length === 0 ? (
            <CompetitionsEmptyState variant="none" canHost={canHost} />
          ) : (
            <>
              {/* Utility bar. Inside the loaded branch and below the hero, but
              above the ledger's own empty state — so a search that matches
              nothing still leaves the reader a search box to edit. */}
              <div className="flex items-center gap-6 py-[22px] border-b border-ns-border">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ns-ink-muted" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search competitions, genres, hosts… (⌘K)"
                    value={query}
                    onChange={(e) =>
                      updateParams({ q: e.target.value || null, page: null })
                    }
                    className="h-11 rounded-[10px] bg-ns-elevated pl-10 pr-4"
                  />
                </div>
                <Link
                  to="/explore/competitions/how-it-works"
                  className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap font-ui text-[13px] font-semibold text-ns-ink-secondary hover:text-ns-ink transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  How it works
                </Link>
                {canHost && (
                  <Link to="/explore/competitions/new">
                    <Button variant="outline" className="whitespace-nowrap">
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Host a competition
                    </Button>
                  </Link>
                )}
              </div>

              {/* Every competition — the ledger table */}
              <div id="ledger" className="py-8 scroll-mt-24">
                <div className="flex items-center gap-4 mb-5 flex-wrap">
                  <h2 className="font-heading text-[32px] text-ns-ink shrink-0">
                    Every competition
                  </h2>
                  <div className="h-px flex-1 min-w-8 bg-ns-border" />
                </div>

                {sorted.length === 0 ? (
                  <CompetitionsEmptyState
                    variant="search"
                    canHost={canHost}
                    onClearSearch={clearSearch}
                  />
                ) : (
                  <>
                    <div
                      className={`hidden md:grid gap-x-5 border-b border-ns-border pb-3 px-1 ${LEDGER_GRID}`}
                    >
                      <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted">
                        Competition
                      </span>
                      <span className="hidden xl:block font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted">
                        Host
                      </span>
                      <span className="hidden xl:block font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted">
                        Opens
                      </span>
                      <span className="hidden xl:block font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted">
                        Entries close
                      </span>
                      <span className="hidden xl:block font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted">
                        Voting closes
                      </span>
                      <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted text-right">
                        Entry
                      </span>
                      <LedgerStatusLegend />
                    </div>

                    <div>
                      {visible.map((competition) => (
                        <CompetitionLedgerRow
                          key={competition.id}
                          competition={competition}
                          now={now}
                        />
                      ))}
                    </div>

                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={goToPage}
                      label={`Showing ${firstIndex + 1}–${firstIndex + visible.length} of ${sorted.length} competition${sorted.length === 1 ? "" : "s"}`}
                      ariaLabel="Competition pagination"
                    />
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  label,
  ariaLabel,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 pt-8">
      <p className="font-ui text-xs text-ns-ink-muted tabular-nums">{label}</p>

      {totalPages > 1 && (
        <nav aria-label={ariaLabel} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className="inline-flex items-center justify-center h-8 w-8 rounded-ns font-ui text-ns-ink-secondary transition-colors hover:bg-ns-surface hover:text-ns-ink disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ns-ink-secondary"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {pageItems(currentPage, totalPages).map((item, index) =>
            item === null ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-1 font-ui text-xs text-ns-ink-muted select-none"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={item === currentPage ? "page" : undefined}
                className={`inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-ns font-ui text-[13px] font-semibold tabular-nums transition-colors ${
                  item === currentPage
                    ? "bg-ns-ink text-ns-bg"
                    : "text-ns-ink-secondary hover:bg-ns-surface hover:text-ns-ink"
                }`}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            className="inline-flex items-center justify-center h-8 w-8 rounded-ns font-ui text-ns-ink-secondary transition-colors hover:bg-ns-surface hover:text-ns-ink disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ns-ink-secondary"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      )}
    </div>
  );
}

export default Competitions;
