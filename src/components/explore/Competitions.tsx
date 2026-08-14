import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CompetitionLedgerRow } from "./CompetitionLedgerRow";
import { LEDGER_GRID } from "@/lib/competitionLedger";
import { pageItems } from "@/lib/pagination";
import { CompetitionsEmptyState } from "./CompetitionsEmptyState";
import { LedgerStatusLegend } from "./LedgerStatusLegend";
import { HostPrizeDialog } from "./HostPrizeDialog";
import { useCompetitionsQuery } from "@/hooks/queries/useCompetitionQueries";
import { useNow, formatCountdown } from "@/hooks/useCountdown";
import { getHostName, getPrizeDisplay } from "@/lib/competitionListing";
import { ICompetition } from "@/types/ICompetition";

const PAGE_SIZE = 8;

type SortKey = "closesAt" | "pool";

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
  const sortKey = (searchParams.get("sort") as SortKey) || "closesAt";
  const sortDir = searchParams.get("dir") === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

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
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    data: competitionsData,
    isLoading: loading,
    error: loadError,
  } = useCompetitionsQuery(user?.uid);
  const competitions = useMemo<ICompetition[]>(
    () => competitionsData ?? [],
    [competitionsData],
  );

  const displayedError =
    error ??
    (loadError ? getErrorMessage(loadError, "Failed to load competitions.") : null);

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

  // Creating only. Editing and cancelling belong to a single competition, so
  // they live on that competition's page.
  const handleStartCreate = () => {
    setDialogOpen(true);
  };

  const searched = useMemo(
    () => competitions.filter((c) => matchesQuery(c, query)),
    [competitions, query],
  );

  const activeCompetitions = useMemo(
    () => searched.filter((c) => c.status === "active"),
    [searched],
  );

  const featured = useMemo(() => {
    if (activeCompetitions.length === 0) return null;
    return activeCompetitions.reduce((best, c) => {
      const bestAmount = best.prizePool ? BigInt(best.prizePool.amount) : 0n;
      const amount = c.prizePool ? BigInt(c.prizePool.amount) : 0n;
      return amount > bestAmount ? c : best;
    }, activeCompetitions[0]);
  }, [activeCompetitions]);

  // No filtering: the ledger lists every competition, in every phase. Search
  // narrows it, sorting reorders it — neither hides a phase from the reader.
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const list = [...searched];
    list.sort((a, b) => {
      switch (sortKey) {
        case "pool": {
          const av = a.prizePool ? BigInt(a.prizePool.amount) : 0n;
          const bv = b.prizePool ? BigInt(b.prizePool.amount) : 0n;
          return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
        }
        case "closesAt":
        default:
          return (a.deadline.getTime() - b.deadline.getTime()) * dir;
      }
    });
    return list;
  }, [searched, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Clamped rather than trusted: `?page=` is user-editable, and a search that
  // narrows the results can strand the reader past the end.
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const visible = sorted.slice(firstIndex, firstIndex + PAGE_SIZE);

  const goToPage = (next: number) => {
    // Page 1 is the default, so it stays out of the URL.
    updateParams({ page: next === 1 ? null : String(next) });
    // Otherwise a page change lands the reader mid-list, wherever they had
    // scrolled to reach the control.
    document.getElementById("ledger")?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      updateParams({ dir: sortDir === "asc" ? "desc" : "asc", page: null });
    } else {
      updateParams({ sort: key, dir: "asc", page: null });
    }
  };

  const clearSearch = () => {
    setSearchParams(new URLSearchParams());
  };

  const featuredCountdown = featured ? formatCountdown(featured.deadline, now) : null;
  const featuredPrize = featured ? getPrizeDisplay(featured) : null;
  const featuredPct =
    featured?.maxParticipants && featured.maxParticipants > 0
      ? Math.min((featured.participants / featured.maxParticipants) * 100, 100)
      : null;

  return (
    <div className="min-h-screen">
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

      <HostPrizeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingCompetition={null}
      />

      {loading ? (
        <div className="py-10 space-y-10">
          <div className="space-y-4">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
          </div>
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
      ) : competitions.length === 0 ? (
        <CompetitionsEmptyState
          variant="none"
          canHost={canHost}
          onHost={handleStartCreate}
        />
      ) : (
        <>
          {/* Featured competition hero */}
          {featured && featuredPrize && featuredCountdown && (
            <div className="relative overflow-hidden py-11 border-b border-ns-border">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(90% 130% at 78% 0%, var(--ns-accent-subtle) 0%, transparent 62%), repeating-linear-gradient(105deg, rgba(212,169,74,.05) 0 1px, transparent 1px 13px)",
                }}
              />
              <div className="relative flex flex-col xl:flex-row gap-12 items-start xl:items-end">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-ns-accent animate-ns-glow-pulse motion-reduce:animate-none" />
                    <span className="font-ui text-[10px] font-bold uppercase tracking-[0.22em] text-ns-accent">
                      {featuredCountdown.isPast
                        ? "Closed"
                        : `Live · Closes in ${featuredCountdown.label}`}
                    </span>
                    <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted">
                      {getHostName(featured)}
                    </span>
                  </div>
                  <h1 className="font-heading font-light text-[44px] sm:text-[3rem] xl:text-[4.75rem] leading-[0.96] tracking-[-0.02em] text-ns-ink max-w-[20ch] text-balance">
                    {featured.title}
                  </h1>
                  <p className="font-body text-xl leading-[1.5] text-ns-ink-secondary max-w-[56ch] mt-5">
                    {featured.description}
                  </p>
                  <div className="flex items-center gap-3 mt-[30px]">
                    <Link to={`/explore/competitions/${featured.id}`}>
                      <Button
                        size="lg"
                        className="bg-ns-ink text-ns-bg hover:opacity-90 rounded-[10px] px-[30px]"
                      >
                        Read the brief & enter
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="w-full xl:w-[330px] shrink-0 rounded-[14px] border border-ns-border bg-ns-elevated p-6 flex flex-col gap-[18px]">
                  <div>
                    <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted mb-1">
                      Prize pool
                    </p>
                    <p className="font-heading text-[52px] leading-[0.9] text-ns-gold-bright">
                      {featuredPrize.amount}
                    </p>
                    <p className="font-ui text-[11px] tracking-[0.14em] text-ns-ink-muted mt-1">
                      {featuredPrize.symbol
                        ? `${featuredPrize.symbol} · winner takes all`
                        : "Legacy prize"}
                    </p>
                  </div>
                  <div className="h-px bg-ns-border" />
                  <div className="flex items-center justify-between">
                    <span className="font-ui text-[13px] text-ns-ink-muted">Category</span>
                    <span className="font-ui text-[13px] font-semibold text-ns-ink">
                      {featured.category}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-ui text-[13px] text-ns-ink-muted">Entrants</span>
                      <span className="font-ui text-[13px] font-semibold text-ns-ink tabular-nums">
                        {featured.participants}
                        {featured.maxParticipants ? ` / ${featured.maxParticipants}` : ""}
                      </span>
                    </div>
                    {featuredPct !== null && <Progress value={featuredPct} />}
                  </div>
                </div>
              </div>
            </div>
          )}

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
            {user && (
              <Button
                variant="outline"
                onClick={handleStartCreate}
                disabled={!canHost}
                title={!canHost ? "Only admins can host a competition" : undefined}
                className="whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Host a competition
              </Button>
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
                onHost={handleStartCreate}
                onClearSearch={clearSearch}
              />
            ) : (
              <>
                <div
                  className={`hidden md:grid gap-x-5 border-b border-ns-border pb-3 px-1 ${LEDGER_GRID}`}
                >
                  <SortHead
                    label="Competition"
                    active={sortKey === "closesAt"}
                    dir={sortDir}
                    onClick={() => toggleSort("closesAt")}
                  />
                  <span className="hidden xl:block font-ui text-[10px] uppercase tracking-[0.18em] text-ns-ink-muted">
                    Host
                  </span>
                  <SortHead
                    label="Pool"
                    align="right"
                    active={sortKey === "pool"}
                    dir={sortDir}
                    onClick={() => toggleSort("pool")}
                  />
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

                <div className="flex flex-col items-center gap-4 pt-8">
                  <p className="font-ui text-xs text-ns-ink-muted tabular-nums">
                    Showing {firstIndex + 1}–{firstIndex + visible.length} of{" "}
                    {sorted.length} competition
                    {sorted.length === 1 ? "" : "s"}
                  </p>

                  {totalPages > 1 && (
                    <nav
                      aria-label="Pagination"
                      className="flex items-center gap-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => goToPage(currentPage - 1)}
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
                            onClick={() => goToPage(item)}
                            aria-label={`Page ${item}`}
                            aria-current={
                              item === currentPage ? "page" : undefined
                            }
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
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-ns font-ui text-ns-ink-secondary transition-colors hover:bg-ns-surface hover:text-ns-ink disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ns-ink-secondary"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </nav>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

function SortHead({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 font-ui text-[10px] uppercase tracking-[0.18em] transition-colors ${
        align === "right" ? "justify-end" : "justify-start"
      } ${active ? "text-ns-ink" : "text-ns-ink-muted hover:text-ns-ink-secondary"}`}
    >
      {label}
      <ChevronDown
        className={`w-3 h-3 transition-transform ${
          active ? "opacity-100" : "opacity-0"
        } ${active && dir === "desc" ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export default Competitions;
