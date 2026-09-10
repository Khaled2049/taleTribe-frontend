import { useState } from "react";
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { FaBook } from "react-icons/fa";
import type { RecommendationItem } from "@/cloudFunctions/recommendations";
import { getApiErrorMessage } from "@/cloudFunctions";
import { useRecommendationExplanation } from "@/hooks/queries/useRecommendationQueries";

interface RecommendationCardProps {
  item: RecommendationItem;
  /** Real cover from story-data; the book mark stands in until it loads. */
  coverUrl?: string;
  prompt?: string;
  seedItemIds?: number[];
  onSimilar?: (item: RecommendationItem) => void;
}

export default function RecommendationCard({
  item,
  coverUrl,
  prompt,
  seedItemIds = [],
  onSimilar,
}: RecommendationCardProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const explain = useRecommendationExplanation();
  const premise =
    item.core_premise ||
    [item.themes[0], item.tone[0]].filter(Boolean).join(" · ") ||
    "A story selected for this shelf.";

  const requestExplanation = () => {
    if (explanation || explain.isPending) return;
    explain.mutate(
      { itemIds: [item.id], prompt, seedItemIds },
      {
        onSuccess: (results) => {
          setExplanation(results[0]?.explanation ?? null);
        },
      },
    );
  };

  return (
    <article className="group">
      <div className="book-perspective mx-auto max-w-[130px]">
        {/* No generated cover art here: a story without a cover gets the same
            book mark the catalog grid gives it (`StoryCover`), so one story
            does not change appearance between the shelf and the grid. */}
        <div className="book-cover relative aspect-[2/3] overflow-hidden rounded-ns mb-2 bg-ns-surface">
          <Link
            to={`/story/${item.story_id}`}
            aria-label={`Read ${item.title}`}
            className="block h-full w-full"
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <FaBook className="text-4xl text-ns-ink-muted opacity-30" />
              </div>
            )}
          </Link>

          {/* Hover detail. `pointer-events-none` on the container so the cover
              stays a single click target for the link underneath; only the
              buttons take pointer events back. */}
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2 bg-black/0 opacity-0 transition-colors duration-300 group-hover:bg-black/60 group-hover:opacity-100 group-focus-within:bg-black/60 group-focus-within:opacity-100">
            <p className="line-clamp-3 font-body text-[10px] leading-relaxed text-white">
              {premise}
            </p>
            <div className="space-y-1 font-ui">
              <button
                type="button"
                onClick={requestExplanation}
                disabled={explain.isPending}
                className="pointer-events-auto flex w-full items-center justify-center rounded-full border border-white/35 bg-black/20 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-white transition-colors hover:bg-white hover:text-stone-900 disabled:cursor-wait disabled:opacity-60"
              >
                {explain.isPending ? "Finding…" : "Why this story?"}
              </button>
              {onSimilar && (
                <button
                  type="button"
                  onClick={() => onSimilar(item)}
                  className="pointer-events-auto flex w-full items-center justify-center gap-1 rounded-full border border-white/35 bg-black/20 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-white transition-colors hover:bg-white hover:text-stone-900"
                >
                  <Compass className="h-3 w-3" />
                  More like this
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-0.5">
        <Link to={`/story/${item.story_id}`} className="block min-w-0">
          <h3
            title={item.title}
            className="truncate font-ui text-sm font-medium text-ns-ink transition-colors duration-200 group-hover:text-ns-accent"
          >
            {item.title}
          </h3>
        </Link>
        <p
          title={item.author || undefined}
          className="truncate font-ui text-xs text-ns-ink-muted"
        >
          {item.author || "TaleTribe author"}
        </p>
      </div>

      {(explanation || explain.isError) && (
        <p className="mt-1.5 border-l-2 border-ns-accent/30 pl-2 font-body text-[11px] leading-relaxed text-ns-ink-secondary">
          {explanation ||
            getApiErrorMessage(
              explain.error,
              "We couldn't explain this match just yet.",
            )}
        </p>
      )}
    </article>
  );
}
