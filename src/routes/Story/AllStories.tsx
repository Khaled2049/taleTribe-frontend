import { useAuthContext } from "../../contexts/AuthContext";
import { FaEye, FaThumbsUp, FaBook } from "react-icons/fa";
import {
  ChevronRight,
  ChevronDown,
  Check,
  Compass,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { SEOHead } from "@/components/seo/SEOHead";
import { APP_NAME } from "@/config/seo";
import StoriesHeader from "@/components/story/StoriesHeader";
import { AuthorName } from "@/components/common";
import { StoryMetadata } from "@novelsync/story-data-client";
import { usePublishedStories } from "@/hooks/queries/useStoryQueries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { RecommendationCollection } from "@/components/recommendations";
import type { RecommendationFilters } from "@/cloudFunctions/recommendations";
import { getApiErrorMessage } from "@/cloudFunctions";
import {
  useBehavioralRecommendations,
  useDiscoverStories,
} from "@/hooks/queries/useRecommendationQueries";

const CATEGORIES = [
  { id: "all", name: "All", value: "all", symbol: "◆" },
  { id: "fiction", name: "Fiction", value: "fiction", symbol: "◗" },
  { id: "non-fiction", name: "Non-Fiction", value: "non-fiction", symbol: "◎" },
  { id: "poetry", name: "Poetry", value: "poetry", symbol: "❧" },
  { id: "fantasy", name: "Fantasy", value: "fantasy", symbol: "✦" },
  {
    id: "science-fiction",
    name: "Sci-Fi",
    value: "science-fiction",
    symbol: "⊙",
  },
  { id: "romance", name: "Romance", value: "romance", symbol: "♡" },
  {
    id: "mystery-thriller",
    name: "Mystery",
    value: "mystery-thriller",
    symbol: "◐",
  },
  { id: "horror", name: "Horror", value: "horror", symbol: "◈" },
  {
    id: "historical-fiction",
    name: "Historical",
    value: "historical-fiction",
    symbol: "⊕",
  },
  { id: "young-adult", name: "Young Adult", value: "young-adult", symbol: "✶" },
] as const;

// Below this a trigram index cannot serve the ILIKE, so a one-character term
// would cost a sequential scan to return most of the table anyway.
const MIN_SEARCH_LENGTH = 2;
const RECOMMENDATIONS_ENABLED =
  import.meta.env.VITE_RECOMMENDATIONS_ENABLED !== "false";

const StoryCover: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <FaBook className="text-4xl text-ns-ink-muted opacity-30" />
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 bg-ns-surface animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
};

const AllStories: React.FC = () => {
  const { user } = useAuthContext();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [genreMenuOpen, setGenreMenuOpen] = useState(false);
  const [discoveryTitle, setDiscoveryTitle] = useState("");
  const [discoveryPrompt, setDiscoveryPrompt] = useState<string | undefined>();
  const genreMenuRef = useRef<HTMLDivElement | null>(null);

  const activeCategory =
    CATEGORIES.find((c) => c.value === selectedCategory) ?? CATEGORIES[0];

  // One request per pause in typing, and only once the term is long enough to
  // be worth a round trip. React Query caches per term, so backspacing to a
  // term already typed this session re-renders without touching the network.
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const search =
    debouncedSearch.length >= MIN_SEARCH_LENGTH ? debouncedSearch : "";

  const {
    data,
    isLoading: loading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePublishedStories(selectedCategory, search);

  const stories = useMemo(
    () => data?.pages.flatMap((page) => page.stories) ?? [],
    [data],
  );

  const recommendationFilters = useMemo<RecommendationFilters | undefined>(
    () =>
      selectedCategory === "all" ? undefined : { genres: [selectedCategory] },
    [selectedCategory],
  );
  const discover = useDiscoverStories();
  const discoveryActive = discover.isPending || Boolean(discover.data);
  const forYou = useBehavioralRecommendations(
    user?.uid,
    recommendationFilters,
    RECOMMENDATIONS_ENABLED && searchInput.trim() === "" && !discoveryActive,
  );

  const navigate = useNavigate();

  // Infinite scroll: fetch the next page when the sentinel nears the viewport.
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" }, // prefetch before the user hits the bottom
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Close the mobile genre menu when clicking outside of it.
  useEffect(() => {
    if (!genreMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        genreMenuRef.current &&
        !genreMenuRef.current.contains(e.target as Node)
      ) {
        setGenreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [genreMenuOpen]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setGenreMenuOpen(false);
    setDiscoveryTitle("");
    setDiscoveryPrompt(undefined);
    discover.reset();
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (discover.data || discover.isError) {
      setDiscoveryTitle("");
      setDiscoveryPrompt(undefined);
      discover.reset();
    }
  };

  const clearDiscovery = () => {
    setDiscoveryTitle("");
    setDiscoveryPrompt(undefined);
    discover.reset();
  };

  const discoverPrompt = () => {
    const prompt = searchInput.trim();
    if (!user || prompt.length < MIN_SEARCH_LENGTH) return;
    setDiscoveryTitle(`Discoveries for “${prompt}”`);
    setDiscoveryPrompt(prompt);
    discover.mutate({
      mode: "adhoc",
      prompt,
      topK: 12,
      filters: recommendationFilters,
    });
  };

  const discoverSimilar = (story: {
    title: string;
    author?: string | null;
  }) => {
    if (!user) return;
    setSearchInput("");
    setDiscoveryTitle(`More like ${story.title}`);
    setDiscoveryPrompt(undefined);
    discover.mutate({
      mode: "adhoc",
      books: [
        {
          title: story.title,
          ...(story.author ? { author: story.author } : {}),
        },
      ],
      topK: 12,
      filters: recommendationFilters,
    });
  };

  // A single row at the head of the story list, above the grid, on every
  // viewport. It stands down whenever search or AI discovery takes over the
  // column, so only one shelf is ever competing for that slot.
  const forYouShelf =
    RECOMMENDATIONS_ENABLED &&
    user &&
    searchInput.trim() === "" &&
    !discoveryActive &&
    (forYou.isLoading || forYou.data) ? (
      <RecommendationCollection
        variant="row"
        eyebrow={
          forYou.data?.mode === "behavioral"
            ? "Chosen from your reading"
            : "A good place to begin"
        }
        title={
          forYou.data?.mode === "behavioral"
            ? "For you"
            : "Popular on TaleTribe"
        }
        data={forYou.data}
        loading={forYou.isLoading}
        error={forYou.error}
        quietError
        onSimilar={discoverSimilar}
      />
    ) : null;

  const handleNewStory = () => {
    if (user) {
      setIsModalOpen(true);
    } else {
      console.error("User not authenticated");
    }
  };

  const handleStoryClick = (story: StoryMetadata) => {
    navigate(`/story/${story.id}`);
  };

  return (
    <>
      <SEOHead
        title={`Discover Stories - ${APP_NAME}`}
        description={`Browse and discover amazing stories from talented writers. Explore fiction, fantasy, romance, sci-fi, and more. Join the ${APP_NAME} community and start reading today.`}
        keywords={[
          "stories",
          "fiction",
          "novels",
          "reading",
          "books",
          "literature",
          "story discovery",
        ]}
        url="/stories"
        canonical="/stories"
      />

      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex gap-8 items-start">
          {/* Left: header + mobile strip + grid */}
          <div className="flex-1 min-w-0">
            <StoriesHeader
              user={user}
              onNewStory={handleNewStory}
              isModalOpen={isModalOpen}
              onCloseModal={() => setIsModalOpen(false)}
            />

            {/* Search — matches title and author server-side, so it reaches
                stories the infinite-scroll grid has not loaded yet. */}
            <form
              role="search"
              className="relative mb-2"
              onSubmit={(event) => {
                event.preventDefault();
                discoverPrompt();
              }}
            >
              <Search
                size={16}
                className="absolute left-0 top-1/2 -translate-y-1/2 text-ns-ink-muted pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search stories by title or author…"
                aria-label="Search stories by title or author"
                className={`w-full pl-6 py-2.5 font-ui text-sm bg-transparent border-0 border-b border-ns-border text-ns-ink placeholder:text-ns-ink-muted focus:outline-none focus:border-ns-accent transition-colors [&::-webkit-search-cancel-button]:hidden ${RECOMMENDATIONS_ENABLED && user ? "pr-32" : "pr-8"}`}
              />
              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    aria-label="Clear search"
                    className="p-1 text-ns-ink-muted transition-colors hover:text-ns-accent"
                  >
                    <X size={14} />
                  </button>
                )}
                {RECOMMENDATIONS_ENABLED && user && (
                  <button
                    type="submit"
                    disabled={
                      searchInput.trim().length < MIN_SEARCH_LENGTH ||
                      discover.isPending
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-ns-accent/30 bg-ns-accent/5 px-2.5 py-1 font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-ns-accent transition-colors hover:bg-ns-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Sparkles className="h-3 w-3" />
                    Discover
                  </button>
                )}
              </div>
            </form>
            <div className="mb-6 min-h-4">
              {RECOMMENDATIONS_ENABLED && searchInput.trim().length >= 2 && (
                <p className="font-ui text-[10px] text-ns-ink-muted">
                  {user
                    ? "Press Enter or choose Discover for a theme-and-mood search."
                    : "Sign in to search by theme, mood, or stories you already love."}
                </p>
              )}
            </div>

            {/* Mobile genre selector (Libby-style dropdown) */}
            <div className="lg:hidden mb-6" ref={genreMenuRef}>
              <span className="font-ui text-[10px] tracking-[0.2em] uppercase text-ns-ink-muted">
                Genre
              </span>
              <div className="relative mt-1.5">
                <button
                  type="button"
                  onClick={() => setGenreMenuOpen((open) => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={genreMenuOpen}
                  className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-ns border border-ns-border bg-ns-surface text-ns-ink font-ui text-sm font-medium transition-colors hover:bg-ns-surface-hover"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="text-xs leading-none text-ns-accent shrink-0"
                      aria-hidden="true"
                    >
                      {activeCategory.symbol}
                    </span>
                    <span className="truncate">{activeCategory.name}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-ns-ink-muted shrink-0 transition-transform duration-200 ${genreMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {genreMenuOpen && (
                  <ul
                    role="listbox"
                    className="absolute z-20 mt-1.5 w-full max-h-[60vh] overflow-y-auto rounded-ns border border-ns-border bg-ns-elevated shadow-ns-lg py-1"
                  >
                    {CATEGORIES.map((category) => {
                      const isActive = selectedCategory === category.value;
                      return (
                        <li
                          key={category.id}
                          role="option"
                          aria-selected={isActive}
                        >
                          <button
                            type="button"
                            onClick={() => handleCategoryChange(category.value)}
                            className={`
                              w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left
                              font-ui text-sm transition-colors
                              ${
                                isActive
                                  ? "text-ns-accent font-medium bg-ns-accent/5"
                                  : "text-ns-ink-secondary hover:bg-ns-surface hover:text-ns-ink"
                              }
                            `}
                          >
                            <span
                              className={`text-xs leading-none w-3 text-center shrink-0 ${isActive ? "text-ns-accent" : "opacity-50"}`}
                              aria-hidden="true"
                            >
                              {category.symbol}
                            </span>
                            <span className="flex-1 truncate">
                              {category.name}
                            </span>
                            {isActive && (
                              <Check className="w-4 h-4 text-ns-accent shrink-0" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {forYouShelf}

            {discover.isError && (
              <div className="mb-6 flex items-center justify-between gap-4 rounded-ns border border-ns-destructive/20 bg-ns-elevated px-4 py-3 font-ui text-sm text-ns-ink-secondary">
                <span>
                  {getApiErrorMessage(
                    discover.error,
                    "AI discovery is temporarily unavailable. Showing regular search results instead.",
                  )}
                </span>
                <button
                  type="button"
                  onClick={clearDiscovery}
                  className="shrink-0 text-xs font-medium text-ns-accent hover:text-ns-ink"
                >
                  Dismiss
                </button>
              </div>
            )}

            {discoveryActive && (
              <RecommendationCollection
                eyebrow="AI story discovery"
                title={discoveryTitle || "Discovering your next story"}
                data={discover.data}
                loading={discover.isPending}
                prompt={discoveryPrompt}
                onSimilar={discoverSimilar}
                onDismiss={clearDiscovery}
              />
            )}

            {/* Story grid */}
            {!discoveryActive && (
              <>
                {isError && (
                  <div className="mb-6 px-4 py-3 rounded-ns border border-ns-destructive/20 bg-ns-accent-subtle text-ns-destructive font-ui text-sm">
                    {error instanceof Error
                      ? error.message
                      : "Failed to load stories. Please try again."}
                  </div>
                )}
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <span className="text-ns-ink-muted font-ui text-sm">
                      Loading stories…
                    </span>
                  </div>
                ) : stories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FaBook className="text-5xl text-ns-ink-muted mb-4 opacity-30" />
                    <h3 className="font-heading text-title font-medium text-ns-ink mb-2">
                      No stories found
                    </h3>
                    <p className="text-ns-ink-secondary font-ui text-sm">
                      {search
                        ? `Nothing matches “${search}”${
                            selectedCategory === "all" ? "" : " in this genre"
                          }.`
                        : selectedCategory === "all"
                          ? "No stories have been published yet."
                          : "No stories found in this category yet."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: list layout */}
                    <div className="sm:hidden divide-y divide-ns-border border-t border-ns-border">
                      {stories.map((story) => (
                        <div
                          key={story.id}
                          onClick={() => handleStoryClick(story)}
                          className="group flex items-center gap-3 py-3 cursor-pointer active:bg-ns-surface-hover transition-colors"
                        >
                          {/* Thumbnail */}
                          <div className="relative w-10 h-[60px] rounded shrink-0 overflow-hidden bg-ns-surface">
                            {story.coverImageUrl || story.thumbnailUrl ? (
                              <img
                                src={story.thumbnailUrl || story.coverImageUrl}
                                alt={story.title}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FaBook className="text-ns-ink-muted opacity-30 text-sm" />
                              </div>
                            )}
                          </div>

                          {/* Text */}
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
                                <AuthorName
                                  userId={story.userId}
                                  fallback={story.author}
                                />
                              </Link>
                            ) : (
                              <p className="text-xs text-ns-ink-muted font-ui truncate mt-0.5">
                                {story.author}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1 text-[11px] text-ns-ink-muted font-ui">
                                <FaEye className="opacity-60" />
                                {story.views >= 1000
                                  ? `${(story.views / 1000).toFixed(1)}K`
                                  : story.views}
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

                          {RECOMMENDATIONS_ENABLED && user && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                discoverSimilar(story);
                              }}
                              aria-label={`Find stories like ${story.title}`}
                              className="rounded-full p-2 text-ns-ink-muted transition-colors hover:bg-ns-surface hover:text-ns-accent"
                            >
                              <Compass className="h-4 w-4" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-ns-ink-muted shrink-0 opacity-40" />
                        </div>
                      ))}
                    </div>

                    {/* Desktop: grid layout */}
                    <div className="hidden sm:grid sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
                      {stories.map((story) => (
                        <div
                          key={story.id}
                          onClick={() => handleStoryClick(story)}
                          className="group cursor-pointer"
                        >
                          <div className="max-w-[130px] mx-auto book-perspective">
                            <div className="book-cover relative aspect-[2/3] rounded-ns overflow-hidden mb-2 bg-ns-surface">
                              <StoryCover
                                src={story.thumbnailUrl || story.coverImageUrl}
                                alt={story.title}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors duration-300 flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100">
                                <p className="text-white text-[10px] line-clamp-3 leading-relaxed font-body">
                                  {story.description}
                                </p>
                                <div className="space-y-2 font-ui text-white">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="flex items-center gap-0.5">
                                      <FaEye />
                                      {story.views >= 1000
                                        ? `${(story.views / 1000).toFixed(1)}K`
                                        : story.views}
                                    </span>
                                    <span className="flex items-center gap-0.5">
                                      <FaThumbsUp /> {story.likes}
                                    </span>
                                  </div>
                                  {RECOMMENDATIONS_ENABLED && user && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        discoverSimilar(story);
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
                                <AuthorName
                                  userId={story.userId}
                                  fallback={story.author}
                                />
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
                      ))}
                    </div>

                    {/* Infinite-scroll sentinel + loading indicator */}
                    <div
                      ref={loadMoreRef}
                      className="h-px"
                      aria-hidden="true"
                    />
                    {isFetchingNextPage && (
                      <div className="flex justify-center py-8">
                        <span className="text-ns-ink-muted font-ui text-sm">
                          Loading more…
                        </span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Right: genre sidebar — desktop only. The offset drops it clear of
              the page heading in the column beside it, which starts lower. */}
          <aside className="hidden lg:block w-40 shrink-0 mt-12">
            <div className="flex items-center h-9 mb-3 border-b border-ns-border">
              <span className="font-ui text-[11px] tracking-[1.5px] uppercase text-ns-ink-muted">
                Genres
              </span>
            </div>
            <nav className="flex flex-col">
              {CATEGORIES.map((category) => {
                const isActive = selectedCategory === category.value;
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryChange(category.value)}
                    className={`
                      group flex items-center gap-2.5 px-3 py-2 text-left
                      border-l-2 transition-all duration-200 text-sm font-ui
                      ${
                        isActive
                          ? "border-ns-accent text-ns-accent bg-ns-accent/5 font-medium"
                          : "border-transparent text-ns-ink-secondary hover:border-ns-border-strong hover:text-ns-ink hover:bg-ns-surface"
                      }
                    `}
                  >
                    <span
                      className={`text-[11px] leading-none w-3 text-center shrink-0 transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`}
                      aria-hidden="true"
                    >
                      {category.symbol}
                    </span>
                    {category.name}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      </div>
    </>
  );
};

export default AllStories;
