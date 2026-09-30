import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Compass } from "lucide-react";
import { FaEye, FaThumbsUp } from "react-icons/fa";
import type { StoryMetadata } from "@novelsync/story-data-client";
import { BookCoverFallback } from "@/components/story/BookCoverFallback";
import { prefetchStoryDetail } from "@/routes/Story/prefetchStoryDetail";

export const ABOVE_THE_FOLD_COVERS = 6;

interface StoryCardProps {
  story: StoryMetadata;
  priority: boolean;
  onOpen: (story: StoryMetadata) => void;
  onSimilar?: (story: StoryMetadata) => void;
}

const formatViews = (views: number) =>
  views >= 1000 ? `${(views / 1000).toFixed(1)}K` : views;

const StoryCover: React.FC<{
  src?: string;
  title: string;
  author?: string;
  priority?: boolean;
}> = ({ src, title, author, priority = false }) => {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return <BookCoverFallback title={title} author={author} />;
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-ns-surface animate-pulse" />
      )}
      <img
        src={src}
        alt={title}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
};

export const StoryGridCard = memo(function StoryGridCard({
  story,
  priority,
  onOpen,
  onSimilar,
}: StoryCardProps) {
  return (
    <div
      onClick={() => onOpen(story)}
      onMouseEnter={() => void prefetchStoryDetail(story.id)}
      onTouchStart={() => void prefetchStoryDetail(story.id)}
      className="group cursor-pointer"
    >
      <div className="max-w-[130px] mx-auto book-perspective">
        <div className="book-cover relative aspect-[2/3] rounded-ns overflow-hidden mb-2 bg-ns-surface">
          <StoryCover
            src={story.thumbnailUrl || story.coverImageUrl}
            title={story.title}
            author={story.author}
            priority={priority}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100">
            <p className="text-white text-[10px] line-clamp-3 leading-relaxed font-body">
              {story.description}
            </p>
            <div className="space-y-2 font-ui text-white">
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-0.5">
                  <FaEye />
                  {formatViews(story.views)}
                </span>
                <span className="flex items-center gap-0.5">
                  <FaThumbsUp /> {story.likes}
                </span>
              </div>
              {onSimilar && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSimilar(story);
                  }}
                  className="flex w-full items-center justify-center gap-1 rounded-full border border-white/35 bg-black/20 px-2 py-1 text-[9px] uppercase tracking-[0.08em] transition-colors hover:bg-white hover:text-stone-900"
                >
                  <Compass className="h-3 w-3" />
                  More like this
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-0.5 min-w-0">
        <h3
          title={story.title}
          className="font-ui font-medium text-sm truncate text-ns-ink group-hover:text-ns-accent transition-colors duration-200"
        >
          {story.title}
        </h3>
        {story.userId ? (
          <Link
            to={`/profile/${story.userId}`}
            title={story.author}
            onClick={(e) => e.stopPropagation()}
            className="block text-xs text-ns-ink-muted font-ui truncate hover:text-ns-accent transition-colors"
          >
            {story.author}
          </Link>
        ) : (
          <p
            title={story.author}
            className="text-xs text-ns-ink-muted font-ui truncate"
          >
            {story.author}
          </p>
        )}
      </div>
    </div>
  );
});

export const StoryListRow = memo(function StoryListRow({
  story,
  priority,
  onOpen,
  onSimilar,
}: StoryCardProps) {
  return (
    <div
      onClick={() => onOpen(story)}
      onMouseEnter={() => void prefetchStoryDetail(story.id)}
      onTouchStart={() => void prefetchStoryDetail(story.id)}
      className="group flex items-center gap-3 py-3 cursor-pointer active:bg-ns-surface-hover transition-colors"
    >
      <div className="relative w-10 h-[60px] rounded shrink-0 overflow-hidden bg-ns-surface">
        {story.coverImageUrl || story.thumbnailUrl ? (
          <img
            src={story.thumbnailUrl || story.coverImageUrl}
            alt={story.title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <BookCoverFallback
            title={story.title}
            author={story.author}
            size="tiny"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-ui font-medium text-sm truncate text-ns-ink group-hover:text-ns-accent transition-colors duration-200">
          {story.title}
        </h3>
        {story.userId ? (
          <Link
            to={`/profile/${story.userId}`}
            onClick={(e) => e.stopPropagation()}
            className="block text-xs text-ns-ink-muted font-ui truncate mt-0.5 hover:text-ns-accent transition-colors"
          >
            {story.author}
          </Link>
        ) : (
          <p className="text-xs text-ns-ink-muted font-ui truncate mt-0.5">
            {story.author}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-[11px] text-ns-ink-muted font-ui">
            <FaEye className="opacity-60" />
            {formatViews(story.views)}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-ns-ink-muted font-ui">
            <FaThumbsUp className="opacity-60" />
            {story.likes}
          </span>
          {story.category && (
            <span className="text-[10px] font-ui text-ns-ink-muted bg-ns-surface px-1.5 py-0.5 rounded capitalize truncate">
              {story.category}
            </span>
          )}
        </div>
      </div>

      {onSimilar && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSimilar(story);
          }}
          aria-label={`Find stories like ${story.title}`}
          className="rounded-full p-2 text-ns-ink-muted transition-colors hover:bg-ns-surface hover:text-ns-accent"
        >
          <Compass className="h-4 w-4" />
        </button>
      )}
      <ChevronRight className="w-4 h-4 text-ns-ink-muted shrink-0 opacity-40" />
    </div>
  );
});
