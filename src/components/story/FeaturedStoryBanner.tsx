import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaBook } from "react-icons/fa";
import { AuthorName } from "@/components/common";
import { STORY_CATEGORIES } from "@/constants/storyOptions";
import { usePublishedStories } from "@/hooks/queries/useStoryQueries";

const categoryLabel = (value?: string) =>
  STORY_CATEGORIES.find((option) => option.value === value)?.label ?? value;

/**
 * Discovery hero: one published story, picked at random per page load.
 *
 * Reads the unfiltered "all" list — the same query key the grid uses — so on the
 * default view this costs no extra fetch, and the pick stays put while the
 * reader filters by genre. Only the first page is drawn from, so an
 * infinite-scroll fetch can't shuffle the pick out from under the reader.
 */
const FeaturedStoryBanner: React.FC = () => {
  const { data, isLoading } = usePublishedStories("all");
  const [coverLoaded, setCoverLoaded] = useState(false);

  const pool = useMemo(() => data?.pages[0]?.stories ?? [], [data]);

  // Rolled once per mount so re-renders never re-pick.
  const seed = useRef(Math.random());
  const featured = pool.length
    ? pool[Math.floor(seed.current * pool.length)]
    : null;

  if (isLoading) {
    return (
      <div className="mb-5 sm:mb-6 h-[260px] sm:h-[320px] lg:h-[360px] rounded-ns-lg bg-ns-surface animate-pulse" />
    );
  }

  if (!featured) return null;

  const cover = featured.coverImageUrl || featured.thumbnailUrl;
  const meta = [
    categoryLabel(featured.category),
    featured.chapterCount
      ? `${featured.chapterCount} chapter${featured.chapterCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  return (
    <>
      <Link
        to={`/story/${featured.id}`}
        aria-label={`Start reading ${featured.title}`}
        className="group relative block h-[260px] sm:h-[320px] lg:h-[360px] overflow-hidden rounded-ns-lg border border-ns-border bg-ns-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ns-bg"
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            decoding="async"
            onLoad={() => setCoverLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-[transform,opacity] duration-500 ease-ns-smooth group-hover:scale-105 ${
              coverLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-ns-gradient">
            <FaBook className="text-5xl text-white/20" />
          </div>
        )}

        {/* Scrim — keeps the title legible over an arbitrary cover. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/10" />

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <span className="font-ui text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-ns-gold">
            Editor's pick
          </span>
          <h2 className="mt-2 font-heading text-2xl sm:text-4xl lg:text-5xl font-medium leading-tight text-white line-clamp-2">
            {featured.title}
          </h2>
          <p className="mt-2 font-ui text-xs sm:text-sm text-white/75 truncate">
            by{" "}
            <AuthorName userId={featured.userId} fallback={featured.author} />
            {meta.map((item) => (
              <span key={item}> · {item}</span>
            ))}
          </p>
          <span className="mt-4 inline-flex items-center rounded-full bg-ns-accent px-5 py-2.5 font-ui text-sm font-medium text-white shadow-ns transition-colors group-hover:bg-ns-accent-hover">
            Start reading
          </span>
        </div>
      </Link>

      {/* Separates the hero from the browsing grid; travels with the banner so
          it can't strand a rule under the header when there's nothing to feature. */}
      <div className="h-px bg-ns-border my-5 sm:my-6" aria-hidden="true" />
    </>
  );
};

export default FeaturedStoryBanner;
