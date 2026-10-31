import { useReaderViewer } from "../../runtime.js";
import { FaBook } from "react-icons/fa";
import { ChevronDown, Check, Search, Sparkles, X } from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReaderMetadataHead } from "../../runtime.js";
import { useReaderEnvironment } from "../../runtime.js";
import {
  genreName,
  genrePath,
  storyPath,
  tagSlug,
} from "../../lib/seoPaths.js";
import { DiscoveryHeader as StoriesHeader } from "../../runtime.js";
import { StoryMetadata } from "@novelsync/story-data-client";
import { usePublishedStories } from "../../hooks/queries/publishedStories.js";
import { STATUS_LABELS, statusFromParam } from "../../lib/storyStatus.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { findScrollParent } from "../../lib/scrollParent.js";
import { useReaderIdentity } from "../../runtime.js";
import { StoryGridSkeleton } from "./StoriesPageSkeleton.js";
import {
  ABOVE_THE_FOLD_COVERS,
  StoryGridCard,
  StoryListRow,
} from "./components/StoryCards.js";
import { RecommendationCollection } from "../../components/recommendations/index.js";
import { BookCoverFallback } from "../../components/story/BookCoverFallback.js";
import type { RecommendationFilters } from "../../recommendations.js";
import { getApiErrorMessage } from "../../errors.js";
import {
  useBehavioralRecommendations,
  useDiscoverStories,
} from "../../hooks/queries/useRecommendationQueries.js";

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

const AllStories: React.FC = () => {
  const { appName: APP_NAME, recommendations } = useReaderEnvironment();
  const RECOMMENDATIONS_ENABLED = !!recommendations;
  const { user } = useReaderViewer();
  const identity = useReaderIdentity();
  const signedIn = identity.isSignedIn;
  const isSmUp = useMediaQuery("(min-width: 640px)");

  const [isModalOpen, setIsModalOpen] = useState(false);
  // The filter lives in the URL (/stories/genre/:genre, /stories/tag/:tag) so
  // every listing is a page a crawler can reach and a reader can share.
  const params = useParams<{ genre?: string; tag?: string }>();
  const knownGenre = CATEGORIES.some((c) => c.value === params.genre);
  const selectedCategory = knownGenre ? (params.genre as string) : "all";
  const tag = params.tag ? tagSlug(params.tag) : "";
  const tagLabel = tag.replace(/-/g, " ");
  // A query parameter, not a route: unlike a genre, a status filter is a view
  // of a page that already exists, so it must not become a page to index.
  const [searchParams, setSearchParams] = useSearchParams();
  const status = statusFromParam(searchParams.get("status"));
  const statusQuery = status ? `?status=${status}` : "";
  const [searchInput, setSearchInput] = useState("");
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [genreMenuOpen, setGenreMenuOpen] = useState(false);
  const [discoveryTitle, setDiscoveryTitle] = useState("");
  const [discoveryPrompt, setDiscoveryPrompt] = useState<string | undefined>();
  const genreMenuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLFormElement | null>(null);

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
    isPlaceholderData,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePublishedStories(selectedCategory, search, tag, status);

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
    identity.uid,
    recommendationFilters,
    RECOMMENDATIONS_ENABLED && recommendationsOpen && searchInput.trim() === "",
  );

  useEffect(() => {
    if (!recommendationsOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setRecommendationsOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [recommendationsOpen]);

  const navigate = useNavigate();

  // Infinite scroll: fetch the next page when the sentinel nears the bottom of
  // whatever element actually scrolls the page.
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
      { root: findScrollParent(node), rootMargin: "400px" }, // prefetch before the user hits the bottom
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

  const resetForCategory = () => {
    setGenreMenuOpen(false);
    setDiscoveryTitle("");
    setDiscoveryPrompt(undefined);
    discover.reset();
  };

  const handleCategoryChange = (category: string) => {
    resetForCategory();
    navigate(`${genrePath(category)}${statusQuery}`);
  };

  const handleStatusChange = (next: typeof status) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next) params.set("status", next);
        else params.delete("status");
        return params;
      },
      { replace: true },
    );
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setRecommendationsOpen(value.trim() === "");
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
    if (!signedIn || prompt.length < MIN_SEARCH_LENGTH) return;
    setRecommendationsOpen(false);
    setDiscoveryTitle(`Discoveries for “${prompt}”`);
    setDiscoveryPrompt(prompt);
    discover.mutate({
      mode: "adhoc",
      prompt,
      topK: 12,
      filters: recommendationFilters,
    });
  };

  const { mutate: runDiscovery } = discover;
  const discoverSimilar = useCallback(
    (story: { title: string; author?: string | null }) => {
      if (!signedIn) return;
      setSearchInput("");
      setRecommendationsOpen(false);
      setDiscoveryTitle(`More like ${story.title}`);
      setDiscoveryPrompt(undefined);
      runDiscovery({
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
    },
    [signedIn, recommendationFilters, runDiscovery],
  );
  const cardSimilar =
    RECOMMENDATIONS_ENABLED && signedIn ? discoverSimilar : undefined;

  const handleNewStory = () => {
    if (user) {
      setIsModalOpen(true);
    } else {
      console.error("User not authenticated");
    }
  };

  const handleStoryClick = useCallback(
    (story: StoryMetadata) => navigate(storyPath(story.id, story.title)),
    [navigate],
  );

  return (
    <>
      {tag ? (
        <ReaderMetadataHead
          title={`Stories tagged “${tagLabel}”`}
          description={`Stories tagged ${tagLabel} on ${APP_NAME}, written by independent authors and free to read online.`}
          // The server indexes a tag once enough stories carry it; until the
          // first page has loaded the client cannot know, so it says nothing.
          noindex={status !== "" || (!loading && stories.length < 3)}
        />
      ) : genreName(selectedCategory) ? (
        <ReaderMetadataHead
          title={`${genreName(selectedCategory)} Stories`}
          description={`Read ${genreName(selectedCategory)?.toLowerCase()} stories by independent writers on ${APP_NAME}. New chapters and new voices, free to read online.`}
          noindex={status !== ""}
        />
      ) : (
        <ReaderMetadataHead
          title="Discover Stories"
          description={`Browse original fiction from independent writers on ${APP_NAME} — fantasy, romance, science fiction, mystery, horror and more, free to read.`}
          url="/stories"
          // An unknown genre in the URL, a search, or a status filter is not a
          // page of its own.
          noindex={
            (!!params.genre && !knownGenre) || search !== "" || status !== ""
          }
        />
      )}

      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex gap-8 items-start">
          {/* Left: header + mobile strip + grid */}
          <div className="flex-1 min-w-0">
            <StoriesHeader
              uid={identity.uid}
              name={user?.firstName || user?.username}
              onNewStory={handleNewStory}
              isModalOpen={isModalOpen}
              onCloseModal={() => setIsModalOpen(false)}
            />

            {/* Search — matches title and author server-side, so it reaches
                stories the infinite-scroll grid has not loaded yet. */}
            <form
              ref={searchRef}
              role="search"
              className="relative z-30 mb-2"
              onSubmit={(event) => {
                event.preventDefault();
                discoverPrompt();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setRecommendationsOpen(false);
              }}
            >
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-[22px] -translate-y-1/2 text-ns-ink-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (!searchInput.trim()) setRecommendationsOpen(true);
                }}
                placeholder="Search stories by title or author…"
                aria-label="Search stories by title or author"
                aria-expanded={
                  RECOMMENDATIONS_ENABLED &&
                  signedIn &&
                  recommendationsOpen &&
                  !searchInput.trim()
                }
                aria-controls="story-search-recommendations"
                className={`w-full rounded-ns border border-ns-border bg-ns-elevated py-3 pl-11 font-ui text-sm text-ns-ink shadow-sm outline-none transition-colors placeholder:text-ns-ink-muted focus:border-ns-accent focus:ring-2 focus:ring-ns-accent/15 [&::-webkit-search-cancel-button]:hidden ${RECOMMENDATIONS_ENABLED && signedIn ? "pr-32" : "pr-8"}`}
              />
              <div className="absolute right-3 top-[22px] flex -translate-y-1/2 items-center gap-1">
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
                {RECOMMENDATIONS_ENABLED &&
                  signedIn &&
                  (searchInput.trim() ? (
                    <button
                      type="submit"
                      disabled={
                        searchInput.trim().length < MIN_SEARCH_LENGTH ||
                        discover.isPending
                      }
                      className="inline-flex items-center gap-1.5 rounded-full bg-ns-accent/10 px-2.5 py-1 font-ui text-xs font-medium text-ns-accent transition-colors hover:bg-ns-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Discover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRecommendationsOpen((open) => !open)}
                      aria-expanded={recommendationsOpen}
                      aria-controls="story-search-recommendations"
                      className="inline-flex items-center gap-1.5 rounded-full bg-ns-accent/10 px-2.5 py-1 font-ui text-xs font-medium text-ns-accent transition-colors hover:bg-ns-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      For you
                    </button>
                  ))}
              </div>
              {RECOMMENDATIONS_ENABLED &&
                signedIn &&
                recommendationsOpen &&
                !searchInput.trim() && (
                  <section
                    id="story-search-recommendations"
                    aria-label="Recommended stories"
                    className="absolute left-0 right-0 top-full mt-2 max-h-[min(70vh,32rem)] overflow-y-auto rounded-ns border border-ns-border bg-ns-elevated p-3 shadow-ns-lg sm:p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3 border-b border-ns-border pb-3">
                      <div>
                        <h2 className="font-heading text-lg font-medium text-ns-ink">
                          {forYou.data?.mode === "behavioral"
                            ? "For you"
                            : "Popular on TheTaleTribe"}
                        </h2>
                        <p className="font-ui text-xs text-ns-ink-muted">
                          {forYou.data?.mode === "behavioral"
                            ? "Chosen from your reading"
                            : "A good place to begin"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecommendationsOpen(false)}
                        aria-label="Close recommendations"
                        className="rounded-full p-1 text-ns-ink-muted hover:bg-ns-surface hover:text-ns-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ns-accent"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {forYou.isLoading ? (
                      <p className="py-5 font-ui text-sm text-ns-ink-muted">
                        Finding stories for you…
                      </p>
                    ) : forYou.isError ? (
                      <p className="py-5 font-ui text-sm text-ns-ink-secondary">
                        Recommendations are unavailable right now. Try searching
                        for a story.
                      </p>
                    ) : forYou.data?.items.length ? (
                      <div className="grid gap-1 sm:grid-cols-2">
                        {forYou.data.items.map((item) => (
                          <Link
                            key={item.id}
                            to={storyPath(item.story_id, item.title)}
                            onClick={() => setRecommendationsOpen(false)}
                            className="group flex min-w-0 items-center gap-3 rounded-ns p-2 no-underline transition-colors hover:bg-ns-surface focus-visible:bg-ns-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-ns-accent"
                          >
                            <span className="h-16 w-11 shrink-0 overflow-hidden rounded-sm bg-ns-surface shadow-sm">
                              {item.cover_url ? (
                                <img
                                  src={item.cover_url}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <BookCoverFallback
                                  title={item.title}
                                  author={item.author}
                                  size="tiny"
                                />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-ui text-sm font-medium text-ns-ink group-hover:text-ns-accent">
                                {item.title}
                              </span>
                              <span className="block truncate font-ui text-xs text-ns-ink-muted">
                                {item.author || "TheTaleTribe author"}
                              </span>
                              {item.core_premise && (
                                <span className="mt-1 block truncate font-body text-xs text-ns-ink-secondary">
                                  {item.core_premise}
                                </span>
                              )}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="py-5 font-ui text-sm text-ns-ink-secondary">
                        No recommendations yet. Search by title or author to
                        explore stories.
                      </p>
                    )}
                  </section>
                )}
            </form>
            <div className="mb-6 min-h-4">
              {RECOMMENDATIONS_ENABLED && searchInput.trim().length >= 2 && (
                <p className="font-ui text-[10px] text-ns-ink-muted">
                  {signedIn
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

            {tag && (
              <p className="mb-6 font-ui text-sm text-ns-ink-secondary">
                Stories tagged “{tagLabel}” ·{" "}
                <Link
                  to="/stories"
                  className="text-ns-accent hover:text-ns-accent-hover"
                >
                  Show all
                </Link>
              </p>
            )}

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
                <div
                  role="radiogroup"
                  aria-label="Filter by story status"
                  className="mb-5 inline-flex overflow-hidden rounded-ns border border-ns-border"
                >
                  {(["", "ongoing", "completed"] as const).map((value) => {
                    const selected = status === value;
                    return (
                      <button
                        key={value || "all"}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-cy={`status-filter-${value || "all"}`}
                        onClick={() => handleStatusChange(value)}
                        className={`px-3.5 py-1.5 font-ui text-xs transition-colors ${
                          selected
                            ? "bg-ns-accent text-white font-medium"
                            : "bg-ns-surface text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink"
                        }`}
                      >
                        {value ? STATUS_LABELS[value] : "All"}
                      </button>
                    );
                  })}
                </div>
                {isError && (
                  <div className="mb-6 px-4 py-3 rounded-ns border border-ns-destructive/20 bg-ns-accent-subtle text-ns-destructive font-ui text-sm">
                    {error instanceof Error
                      ? error.message
                      : "Failed to load stories. Please try again."}
                  </div>
                )}
                {loading ? (
                  <StoryGridSkeleton />
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
                        : status
                          ? `No ${STATUS_LABELS[status].toLowerCase()} stories here yet.`
                          : tag
                            ? `No stories are tagged “${tagLabel}” yet.`
                            : selectedCategory === "all"
                              ? "No stories have been published yet."
                              : "No stories found in this category yet."}
                    </p>
                  </div>
                ) : (
                  <div
                    aria-busy={isPlaceholderData}
                    className={`transition-opacity duration-200 ${isPlaceholderData ? "opacity-50" : ""}`}
                  >
                    {isSmUp ? (
                      <div
                        data-cy="story-grid"
                        className="grid grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2"
                      >
                        {stories.map((story, index) => (
                          <StoryGridCard
                            key={story.id}
                            story={story}
                            priority={index < ABOVE_THE_FOLD_COVERS}
                            onOpen={handleStoryClick}
                            onSimilar={cardSimilar}
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        data-cy="story-list"
                        className="divide-y divide-ns-border border-t border-ns-border"
                      >
                        {stories.map((story, index) => (
                          <StoryListRow
                            key={story.id}
                            story={story}
                            priority={index < ABOVE_THE_FOLD_COVERS}
                            onOpen={handleStoryClick}
                            onSimilar={cardSimilar}
                          />
                        ))}
                      </div>
                    )}

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
                  </div>
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
                  <Link
                    key={category.id}
                    to={`${genrePath(category.value)}${statusQuery}`}
                    onClick={resetForCategory}
                    aria-current={isActive ? "page" : undefined}
                    className={`
                      group flex items-center gap-2.5 px-3 py-2 text-left no-underline
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
                  </Link>
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
