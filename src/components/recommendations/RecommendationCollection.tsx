import { ArrowLeft, Sparkles } from "lucide-react";
import type {
  RecommendationData,
  RecommendationItem,
} from "@/cloudFunctions/recommendations";
import { getApiErrorMessage } from "@/cloudFunctions";
import { useStoryCovers } from "@/hooks/queries/useStoryQueries";
import RecommendationCard from "./RecommendationCard";

/**
 * `grid` is the full-width shelf in the main column (AI discovery results),
 * wrapping to as many rows as the result set needs.
 * `row` is the standing shelf at the head of the story list: always a single
 * row, scrolling sideways rather than wrapping once the covers stop fitting.
 */
type CollectionVariant = "grid" | "row";

const CARD_GRID: Record<CollectionVariant, string> = {
  grid: "grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6",
  // Tracks share the column the way the catalog grid's six do, so the row
  // spans the full width and its covers land on the grid's own columns. The
  // 120px floor is what makes it a *row*: past that the tracks stop shrinking
  // and the shelf scrolls sideways instead of wrapping to a second line.
  row: "grid grid-flow-col auto-cols-[minmax(120px,1fr)] gap-2 overflow-x-auto pb-1",
};

const SKELETON_COUNT: Record<CollectionVariant, number> = {
  grid: 3,
  row: 6,
};

interface RecommendationCollectionProps {
  eyebrow: string;
  title: string;
  data?: RecommendationData;
  loading?: boolean;
  error?: unknown;
  prompt?: string;
  variant?: CollectionVariant;
  onSimilar?: (item: RecommendationItem) => void;
  onDismiss?: () => void;
  quietError?: boolean;
}

function ShelfSkeleton({ variant }: { variant: CollectionVariant }) {
  return (
    <div className={CARD_GRID[variant]} aria-hidden="true">
      {Array.from({ length: SKELETON_COUNT[variant] }, (_, item) => (
        <div key={item}>
          <div className="aspect-[2/3] animate-pulse rounded-ns border border-ns-border bg-ns-surface" />
          <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-ns-surface" />
        </div>
      ))}
    </div>
  );
}

export default function RecommendationCollection({
  eyebrow,
  title,
  data,
  loading = false,
  error,
  prompt,
  variant = "grid",
  onSimilar,
  onDismiss,
  quietError = false,
}: RecommendationCollectionProps) {
  // Hooks run before the quiet-error bail-out so the order stays stable.
  const covers = useStoryCovers(data?.items.map((item) => item.story_id) ?? []);

  if (error && quietError) return null;

  const seedItemIds = data?.resolved_books?.map((book) => book.id) ?? [];

  const cards = loading ? (
    <ShelfSkeleton variant={variant} />
  ) : error ? (
    <div className="rounded-ns border border-ns-destructive/20 bg-ns-elevated px-4 py-5 font-ui text-sm text-ns-ink-secondary">
      {getApiErrorMessage(
        error,
        "Recommendations are taking a break. Your regular story search is still available.",
      )}
    </div>
  ) : !data || data.items.length === 0 ? (
    <div className="rounded-ns border border-dashed border-ns-border px-4 py-8 text-center">
      <p className="font-heading text-lg text-ns-ink">No matches yet</p>
      <p className="mt-1 font-ui text-xs text-ns-ink-muted">
        Try a broader mood, theme, or genre.
      </p>
    </div>
  ) : (
    <div className={CARD_GRID[variant]}>
      {data.items.map((item) => (
        <RecommendationCard
          key={item.id}
          item={item}
          coverUrl={covers[item.story_id]}
          prompt={prompt}
          seedItemIds={seedItemIds}
          onSimilar={onSimilar}
        />
      ))}
    </div>
  );

  return (
    <section className="relative mb-8 overflow-hidden rounded-ns border border-ns-border bg-[linear-gradient(135deg,var(--ns-surface)_0%,var(--ns-elevated)_55%,var(--ns-surface)_100%)] p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full border border-ns-accent/10" />
      <div className="pointer-events-none absolute -right-3 -top-8 h-20 w-20 rounded-full border border-ns-accent/15" />

      <div className="relative mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-1.5 font-ui text-[9px] uppercase tracking-[0.22em] text-ns-accent">
            <Sparkles className="h-3 w-3" />
            {eyebrow}
          </p>
          <h2 className="font-heading text-xl font-medium text-ns-ink sm:text-2xl">
            {title}
          </h2>
          {data?.mode === "popular" && (
            <p className="mt-1 font-ui text-xs text-ns-ink-muted">
              A popular shelf while we learn your reading taste.
            </p>
          )}
          {data?.degraded && (
            <p className="mt-1 font-ui text-xs text-ns-ink-muted">
              A smaller shelf is shown while discovery catches up.
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ns-border px-3 py-1.5 font-ui text-[11px] text-ns-ink-secondary transition-colors hover:border-ns-border-strong hover:text-ns-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Catalog
          </button>
        )}
      </div>

      <div className="relative">{cards}</div>
    </section>
  );
}
