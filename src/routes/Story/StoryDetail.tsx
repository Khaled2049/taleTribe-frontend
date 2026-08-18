import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Link, useParams } from "react-router-dom";
import { publicStoryRepo } from "@/services/PublicStoryRepo";
import { Chapter, Story } from "@/types/IStory";
import { storySocialRepo } from "@/services/StorySocialRepo";
import { useAuthContext } from "@/contexts/AuthContext";
import { useComments, useCommentCache } from "@/hooks/queries/useCommentQueries";
import { StoryLoadingState } from "./components/StoryLoadingState";
import { StoryErrorState } from "./components/StoryErrorState";
import { StorySynopsis } from "./components/StorySynopsis";
import { BookOpen, Heart } from "lucide-react";
import { StoryAuthorBio } from "./components/StoryAuthorBio";
import { StoryCommentsSection } from "./components/StoryCommentsSection";
import { ChapterReader } from "./components/reader/ChapterReader";
import { useUserWalletAddress } from "@/hooks/useUserWalletAddress";
import { SEOHead } from "@/components/seo/SEOHead";
import { AuthorName } from "@/components/common";
import { getAbsoluteUrl } from "@/config/seo";
import { readingHistoryRepo } from "@/services/ReadingHistoryRepo";

interface StoryDetailState {
  story: Story | null;
  chapters: Omit<Chapter, "content">[];
  currentChapter: Chapter | null;
  currentChapterIndex: number;
  likes: number;
  loading: boolean;
  chapterLoading: boolean;
  chapterError: string | null;
  error: string | null;
  isLiked: boolean;
  userRating: number | null;
  ratingsCount: number;
}

type ViewMode = "details" | "reader";

const CHAPTER_FETCH_TIMEOUT_MS = 15000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const StoryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthContext();

  const [viewMode, setViewMode] = useState<ViewMode>("details");
  const [hoveredHeroStar, setHoveredHeroStar] = useState<number | null>(null);

  const [state, setState] = useState<StoryDetailState>({
    story: null,
    chapters: [],
    currentChapter: null,
    currentChapterIndex: 0,
    likes: 0,
    loading: true,
    chapterLoading: false,
    chapterError: null,
    error: null,
    isLiked: false,
    userRating: null,
    ratingsCount: 0,
  });

  const { data: comments = [], isPending: commentsLoading } = useComments(
    id,
    state.currentChapter?.id,
  );
  const { upsert: upsertComment, remove: removeComment } = useCommentCache(
    id,
    state.currentChapter?.id,
  );

  const { walletAddress: authorWalletAddress } = useUserWalletAddress(
    state.story?.userId,
  );

  const chapterContentCache = useRef<Record<string, string>>({});
  // Id of the chapter the reader currently wants. Used to discard stale
  // responses when the user navigates faster than the network resolves.
  const activeChapterId = useRef<string | null>(null);
  // Saved resume position (chapter + scroll), captured on load.
  const resumeRef = useRef<{
    chapterId: string | null;
    scrollPercent: number;
  } | null>(null);
  const [readNowPending, setReadNowPending] = useState(false);

  // --- Data Loading ---

  // Best-effort background fetch of a neighbouring chapter into the cache.
  const prefetchChapter = useCallback(
    (
      chapters: Omit<Chapter, "content">[],
      index: number,
      authorId: string,
    ) => {
      if (!id) return;
      const meta = chapters[index];
      if (!meta || chapterContentCache.current[meta.id]) return;
      publicStoryRepo
        .getChapter(id, meta.id, authorId)
        .then((c) => {
          if (c) chapterContentCache.current[c.id] = c.content;
        })
        .catch(() => {
          // Prefetch is best-effort; failures are retried on actual navigation.
        });
    },
    [id],
  );

  const loadChapterContent = useCallback(
    async (
      index: number,
      chapters: Omit<Chapter, "content">[],
      authorId: string,
    ) => {
      if (!id) return;
      const chapterMeta = chapters[index];
      if (!chapterMeta) return;

      // Mark this chapter as the one we want; later resolutions check against it.
      activeChapterId.current = chapterMeta.id;

      const cached = chapterContentCache.current[chapterMeta.id];
      if (cached) {
        setState((prev) => ({
          ...prev,
          currentChapter: { ...chapterMeta, content: cached } as Chapter,
          chapterLoading: false,
          chapterError: null,
        }));
        // Warm neighbours even on a cache hit.
        prefetchChapter(chapters, index + 1, authorId);
        prefetchChapter(chapters, index - 1, authorId);
        return;
      }

      setState((prev) => ({
        ...prev,
        chapterLoading: true,
        chapterError: null,
      }));

      try {
        const fullChapter = await withTimeout(
          publicStoryRepo.getChapter(id, chapterMeta.id, authorId),
          CHAPTER_FETCH_TIMEOUT_MS,
          "Chapter fetch",
        );

        // A newer navigation superseded this request — drop the stale result.
        if (activeChapterId.current !== chapterMeta.id) return;

        if (!fullChapter) {
          setState((prev) => ({
            ...prev,
            chapterLoading: false,
            chapterError: "This chapter could not be found.",
          }));
          return;
        }

        chapterContentCache.current[fullChapter.id] = fullChapter.content;
        setState((prev) => ({
          ...prev,
          currentChapter: fullChapter,
          chapterLoading: false,
          chapterError: null,
        }));

        // Prefetch both neighbours so back/forward feel instant.
        prefetchChapter(chapters, index + 1, authorId);
        prefetchChapter(chapters, index - 1, authorId);
      } catch (error) {
        console.error("Error loading chapter content:", error);
        if (activeChapterId.current !== chapterMeta.id) return;
        setState((prev) => ({
          ...prev,
          chapterLoading: false,
          chapterError: "Failed to load this chapter. Please try again.",
        }));
      }
    },
    [id, prefetchChapter],
  );

  const loadStory = useCallback(
    async (
      storyId: string,
      chapterIndex: number = 0,
      resumeChapterId: string | null = null,
    ) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const [detail, me] = await Promise.all([
          publicStoryRepo.getStoryDetail(storyId),
          user ? storySocialRepo.getMe(storyId).catch(() => null) : Promise.resolve(null),
        ]);

        if (!detail) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "Story not found",
          }));
          return;
        }

        const { story: storyData, chapters: chaptersMetaList } = detail;
        const savedChapterIndex = resumeChapterId
          ? chaptersMetaList.findIndex((chapter) => chapter.id === resumeChapterId)
          : -1;
        const validChapterIndex = Math.max(
          0,
          Math.min(
            savedChapterIndex >= 0 ? savedChapterIndex : chapterIndex,
            chaptersMetaList.length - 1,
          ),
        );

        setState((prev) => ({
          ...prev,
          story: storyData,
          chapters: chaptersMetaList,
          currentChapter: null,
          currentChapterIndex: validChapterIndex,
          likes: storyData.likes,
          isLiked: me?.liked || false,
          userRating: me?.rating ?? null,
          ratingsCount: storyData.ratingsCount || 0,
          loading: false,
        }));

        void publicStoryRepo.recordView(storyId).catch(() => {});
        // Load the starting chapter content (prefetches next inside)
        await loadChapterContent(
          validChapterIndex,
          chaptersMetaList,
          storyData.userId,
        );
      } catch (error) {
        console.error("Error fetching story:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to load story",
        }));
      }
    },
    [user, loadChapterContent],
  );

  // --- Handlers ---
  const handleLike = useCallback(async () => {
    if (!id || !user) return;

    const previousIsLiked = state.isLiked;
    const previousLikes = state.likes;

    setState((prev) => ({
      ...prev,
      isLiked: !prev.isLiked,
      likes: prev.isLiked ? Math.max(0, prev.likes - 1) : prev.likes + 1,
    }));

    try {
      const social = await storySocialRepo.setLike(id, !previousIsLiked);
      setState((prev) => ({
        ...prev,
        isLiked: !previousIsLiked,
        likes: social.likeCount,
      }));
    } catch (error) {
      console.error("Error toggling like:", error);
      setState((prev) => ({
        ...prev,
        isLiked: previousIsLiked,
        likes: previousLikes,
      }));
    }
  }, [id, user, state.isLiked, state.likes]);

  const handleRatingSubmit = useCallback(
    async (rating: number) => {
      if (!id || !user) return;
      if (state.userRating !== null) return;

      const previousUserRating = state.userRating;
      const previousRatingsCount = state.ratingsCount;
      const previousAverageRating = state.story?.averageRating;

      setState((prev) => ({
        ...prev,
        userRating: rating,
        ratingsCount: prev.ratingsCount + 1,
      }));

      try {
        const social = await storySocialRepo.createRating(id, rating);
        setState((prev) => ({
          ...prev,
          story: prev.story
            ? { ...prev.story, averageRating: social.averageRating }
            : null,
          ratingsCount: social.ratingsCount,
        }));
      } catch (error) {
        console.error("Error submitting rating:", error);
        setState((prev) => ({
          ...prev,
          userRating: previousUserRating,
          ratingsCount: previousRatingsCount,
          story: prev.story
            ? { ...prev.story, averageRating: previousAverageRating }
            : null,
        }));
      }
    },
    [id, user, state.userRating, state.ratingsCount, state.story],
  );

  const handlePrevChapter = useCallback(() => {
    const prevIndex = Math.max(state.currentChapterIndex - 1, 0);
    const chapterMeta = state.chapters[prevIndex];
    const cached = chapterMeta
      ? chapterContentCache.current[chapterMeta.id]
      : null;

    // Record the target so any in-flight fetch for another chapter is dropped.
    if (chapterMeta) activeChapterId.current = chapterMeta.id;

    if (id && user && state.story) {
      if (chapterMeta) readingHistoryRepo.saveProgress(id, chapterMeta.id);
    }

    setState((prev) => ({
      ...prev,
      currentChapterIndex: prevIndex,
      chapterError: null,
      ...(cached && chapterMeta
        ? {
            currentChapter: { ...chapterMeta, content: cached } as Chapter,
            chapterLoading: false,
          }
        : { chapterLoading: true }),
    }));

    if (!cached) loadChapterContent(prevIndex, state.chapters, state.story?.userId || "");
    window.scrollTo(0, 0);
  }, [
    id,
    user,
    state.currentChapterIndex,
    state.chapters,
    state.story,
    loadChapterContent,
  ]);

  const handleNextChapter = useCallback(() => {
    const nextIndex = Math.min(
      state.currentChapterIndex + 1,
      state.chapters.length - 1,
    );
    const chapterMeta = state.chapters[nextIndex];
    const cached = chapterMeta
      ? chapterContentCache.current[chapterMeta.id]
      : null;

    // Record the target so any in-flight fetch for another chapter is dropped.
    if (chapterMeta) activeChapterId.current = chapterMeta.id;

    if (id && user && state.story) {
      if (chapterMeta) readingHistoryRepo.saveProgress(id, chapterMeta.id);
    }

    setState((prev) => ({
      ...prev,
      currentChapterIndex: nextIndex,
      chapterError: null,
      ...(cached && chapterMeta
        ? {
            currentChapter: { ...chapterMeta, content: cached } as Chapter,
            chapterLoading: false,
          }
        : { chapterLoading: true }),
    }));

    if (!cached) loadChapterContent(nextIndex, state.chapters, state.story?.userId || "");
    window.scrollTo(0, 0);
  }, [
    id,
    user,
    state.currentChapterIndex,
    state.chapters,
    state.story,
    loadChapterContent,
  ]);

  const handleRetryChapter = useCallback(() => {
    loadChapterContent(
      state.currentChapterIndex,
      state.chapters,
      state.story?.userId || "",
    );
  }, [loadChapterContent, state.currentChapterIndex, state.chapters, state.story?.userId]);

  const handleScrollPersist = useCallback(
    (percent: number) => {
      if (!id || !user) return;
      if (state.currentChapter) readingHistoryRepo.saveProgress(id, state.currentChapter.id, percent);
    },
    [id, user, state.currentChapterIndex],
  );

  // --- Comment Logic ---
  // Each write returns the affected comment, so the thread is patched in place
  // rather than re-fetched whole.
  const handleCreateComment = useCallback(
    async (message: string) => {
      if (!id || !state.currentChapter) return;
      upsertComment(
        await storySocialRepo.createComment(id, state.currentChapter.id, message),
      );
    },
    [id, state.currentChapter, upsertComment],
  );

  const handleReply = useCallback(
    async (parentId: string, message: string) => {
      if (!id || !state.currentChapter) return;
      try {
        upsertComment(
          await storySocialRepo.createComment(id, state.currentChapter.id, message, parentId),
        );
      } catch (error) {
        console.error("Error adding reply:", error);
      }
    },
    [id, state.currentChapter, upsertComment],
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!id || !state.currentChapter) return;
      try {
        await storySocialRepo.deleteComment(id, state.currentChapter.id, commentId);
        removeComment(commentId);
      } catch (error) {
        console.error("Error deleting comment:", error);
      }
    },
    [id, state.currentChapter, removeComment],
  );

  const handleEdit = useCallback(
    async (commentId: string, newMessage: string) => {
      if (!id || !state.currentChapter) return;
      try {
        upsertComment(
          await storySocialRepo.updateComment(id, state.currentChapter.id, commentId, newMessage),
        );
      } catch (error) {
        console.error("Error updating comment:", error);
      }
    },
    [id, state.currentChapter, upsertComment],
  );

  const handleCommentLike = useCallback(
    async (commentId: string, liked: boolean) => {
      if (!id || !state.currentChapter) return;
      try {
        upsertComment(
          await storySocialRepo.setCommentLike(id, state.currentChapter.id, commentId, liked),
        );
      } catch (error) {
        console.error("Error updating comment like:", error);
      }
    },
    [id, state.currentChapter, upsertComment],
  );

  // --- Effects ---
  useEffect(() => {
    if (!id) return;
    const init = async () => {
      let startIndex = 0;
      if (user) {
        const progress = await readingHistoryRepo.getProgress(id);
        resumeRef.current = progress;
        loadStory(id, startIndex, progress.chapterId);
        return;
      }
      loadStory(id, startIndex);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // --- Render ---
  if (state.loading) {
    return <StoryLoadingState />;
  }

  if (state.error || !state.story) {
    return (
      <StoryErrorState
        error={state.error}
        onRetry={() => id && loadStory(id)}
      />
    );
  }

  // --- VIEW 1: DETAILS ---
  if (viewMode === "details") {
    const genres = state.story.tags || ["Fiction", "Adventure", "Fantasy"];
    const storyUrl = `/story/${state.story.id}`;
    const storyImage = state.story.coverImageUrl
      ? getAbsoluteUrl(state.story.coverImageUrl)
      : getAbsoluteUrl("/book.svg");

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Book",
      name: state.story.title,
      description: state.story.description,
      author: {
        "@type": "Person",
        name: state.story.author,
      },
      image: storyImage,
      url: getAbsoluteUrl(storyUrl),
      datePublished: state.story.createdAt.toISOString(),
      dateModified: state.story.updatedAt.toISOString(),
      aggregateRating: state.story.averageRating
        ? {
            "@type": "AggregateRating",
            ratingValue: state.story.averageRating,
            ratingCount: state.ratingsCount || 0,
          }
        : undefined,
      keywords: genres.join(", "),
      numberOfPages: state.chapters.length,
    };

    const canRate = !!user && state.userRating === null;
    const displayRating = state.userRating ?? state.story.averageRating ?? 0;
    const starsToShow = hoveredHeroStar ?? displayRating;

    return (
      <>
        <SEOHead
          title={state.story.title}
          description={state.story.description}
          keywords={genres}
          image={state.story.coverImageUrl}
          url={storyUrl}
          type="article"
          author={state.story.author}
          publishedTime={state.story.createdAt.toISOString()}
          modifiedTime={state.story.updatedAt.toISOString()}
          canonical={storyUrl}
          structuredData={structuredData}
        />

        <div className="min-h-screen bg-ns-bg font-body">
          {/* ── Header: cover + title side by side ── */}
          <div className="max-w-5xl mx-auto px-6 pt-28 pb-10 border-b border-ns-border">
            <div className="flex flex-col sm:flex-row gap-8 sm:gap-10 items-start">
              {/* Book cover */}
              <div className="flex-shrink-0 w-36 sm:w-44 aspect-[2/3] rounded-ns-lg shadow-ns-xl overflow-hidden ring-1 ring-ns-border/40 self-start">
                {state.story.coverImageUrl ? (
                  <img
                    src={state.story.coverImageUrl}
                    alt={state.story.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-ns-elevated flex items-center justify-center">
                    <span className="font-heading italic text-3xl text-ns-ink-muted opacity-40">
                      {state.story.title.charAt(0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Title block */}
              <div className="flex-1 min-w-0 pt-1">
                {/* Genre pills */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {genres.map((g) => (
                    <span
                      key={g}
                      className="px-2.5 py-0.5 rounded-full border border-ns-border font-ui text-[10px] uppercase tracking-widest text-ns-ink-muted"
                    >
                      {g}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h1 className="font-heading italic text-5xl sm:text-6xl md:text-7xl text-ns-ink leading-[0.88] mb-5 tracking-tight">
                  {state.story.title}
                </h1>

                {/* Author + stats */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-6">
                  <span className="font-ui text-xs text-ns-ink-muted">by</span>
                  <Link
                    to={`/profile/${state.story.userId}`}
                    className="font-ui text-sm text-ns-ink hover:text-ns-accent transition-colors"
                  >
                    <AuthorName
                      userId={state.story.userId}
                      fallback={state.story.author}
                    />
                  </Link>
                  <span className="text-ns-border select-none">·</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => canRate && handleRatingSubmit(star)}
                        onMouseEnter={() => canRate && setHoveredHeroStar(star)}
                        onMouseLeave={() => setHoveredHeroStar(null)}
                        disabled={!canRate}
                        className={`text-base leading-none transition-all duration-100 ${
                          star <= Math.round(starsToShow)
                            ? "text-ns-gold"
                            : "text-ns-border"
                        } ${canRate ? "cursor-pointer hover:scale-125" : "cursor-default"}`}
                        aria-label={`Rate ${star} stars`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <span className="font-ui text-xs text-ns-ink-muted">
                    {state.ratingsCount > 0
                      ? `${state.ratingsCount} ${state.ratingsCount === 1 ? "rating" : "ratings"}`
                      : "No ratings yet"}
                  </span>
                  <span className="text-ns-border select-none">·</span>
                  <span className="font-ui text-xs text-ns-ink-muted">
                    {state.chapters.length}{" "}
                    {state.chapters.length === 1 ? "chapter" : "chapters"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      if (readNowPending) return;
                      setReadNowPending(true);
                      if (id && user && state.story) {
                        if (state.currentChapter) readingHistoryRepo.saveProgress(id, state.currentChapter.id);
                      }
                      setTimeout(() => {
                        setReadNowPending(false);
                        setViewMode("reader");
                      }, 500);
                    }}
                    disabled={readNowPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-ns-accent text-white font-ui text-sm font-medium rounded-ns shadow-ns-sm hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150 disabled:opacity-70 disabled:cursor-wait"
                  >
                    {readNowPending ? (
                      <>
                        <svg
                          className="w-4 h-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Opening…
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-4 h-4" />
                        Read Now
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleLike}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-ns border font-ui text-sm transition-all duration-150 active:scale-[0.97] ${
                      state.isLiked
                        ? "border-ns-accent text-ns-accent bg-ns-accent-subtle"
                        : "border-ns-border text-ns-ink-secondary hover:border-ns-border-strong hover:text-ns-ink hover:bg-ns-surface-hover"
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 transition-all ${state.isLiked ? "fill-current" : ""}`}
                    />
                    {state.likes} {state.likes === 1 ? "Like" : "Likes"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="max-w-5xl mx-auto px-6 py-12">
            <main className="max-w-2xl mx-auto">
              <StorySynopsis description={state.story.description} />

              {/* Ornamental divider */}
              <div className="flex items-center gap-4 my-10">
                <div className="flex-1 h-px bg-ns-border" />
                <span className="text-ns-ink-muted text-xs select-none">✦</span>
                <div className="flex-1 h-px bg-ns-border" />
              </div>

              <StoryAuthorBio
                author={state.story.author}
                authorId={state.story.userId}
                authorWalletAddress={authorWalletAddress || undefined}
                storyId={id!}
              />

              <div className="flex items-center gap-4 my-10">
                <div className="flex-1 h-px bg-ns-border" />
                <span className="text-ns-ink-muted text-xs select-none">✦</span>
                <div className="flex-1 h-px bg-ns-border" />
              </div>

              {state.currentChapter && (
                <StoryCommentsSection
                  comments={comments}
                  commentsLoading={commentsLoading}
                  currentUser={user}
                  onCreate={handleCreateComment}
                  onReply={handleReply}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onLike={handleCommentLike}
                />
              )}
            </main>
          </div>
        </div>
      </>
    );
  }

  // --- VIEW 2: READER ---
  if (!state.currentChapter) {
    return <StoryLoadingState />;
  }

  // Only the resumed chapter restores scroll; everything else starts at top.
  // useScrollProgress guards against restoring more than once per chapter entry.
  const resumeScrollPercent =
    resumeRef.current &&
    state.currentChapter.id === resumeRef.current.chapterId &&
    resumeRef.current.scrollPercent > 0
      ? resumeRef.current.scrollPercent
      : null;

  return (
    <ChapterReader
      currentChapter={state.currentChapter}
      currentChapterIndex={state.currentChapterIndex}
      totalChapters={state.chapters.length}
      chapterLoading={state.chapterLoading}
      chapterError={state.chapterError}
      onRetryChapter={handleRetryChapter}
      onBackToDetails={() => setViewMode("details")}
      onPrevChapter={handlePrevChapter}
      onNextChapter={handleNextChapter}
      resumeScrollPercent={resumeScrollPercent}
      onScrollPersist={handleScrollPersist}
    />
  );
};

export default StoryDetail;
