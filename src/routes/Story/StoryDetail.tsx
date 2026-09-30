import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { publicStoryRepo } from "@novelsync/story-data-client";
import { Chapter, Story } from "@novelsync/story-data-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePublicStory,
  useStoryViewer,
  type PublicStoryDetail,
  type StoryViewer,
} from "@/hooks/queries/publicStory";
import { queryKeys } from "@/hooks/queries/queryKeys";
import { storySocialRepo } from "@novelsync/story-data-client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAuthIdentity } from "@novelsync/platform-auth";
import {
  useComments,
  useCommentCache,
} from "@/hooks/queries/useCommentQueries";
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
import { BookCoverFallback } from "@/components/story/BookCoverFallback";
import { getAbsoluteUrl } from "@/config/seo";
import { readingHistoryRepo } from "@novelsync/story-data-client";

interface ReaderState {
  currentChapter: Chapter | null;
  currentChapterIndex: number;
  chapterLoading: boolean;
  chapterError: string | null;
}

const NO_CHAPTERS: Omit<Chapter, "content">[] = [];

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
  const { uid, loading: authLoading } = useAuthIdentity();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>("details");
  const [hoveredHeroStar, setHoveredHeroStar] = useState<number | null>(null);

  const [state, setState] = useState<ReaderState>({
    currentChapter: null,
    currentChapterIndex: 0,
    chapterLoading: false,
    chapterError: null,
  });

  const detailQuery = usePublicStory(id);
  const viewerQuery = useStoryViewer(id, uid);
  const story = detailQuery.data?.story ?? null;
  const chapters = detailQuery.data?.chapters ?? NO_CHAPTERS;
  const chapterCount = detailQuery.isPlaceholderData
    ? (story?.chapterCount ?? 0)
    : chapters.length;
  const likes = story?.likes ?? 0;
  const ratingsCount = story?.ratingsCount ?? 0;
  const isLiked = uid ? (viewerQuery.data?.liked ?? false) : false;
  const userRating = uid ? (viewerQuery.data?.rating ?? null) : null;

  const { data: comments = [], isPending: commentsLoading } = useComments(id);
  const { upsert: upsertComment, remove: removeComment } = useCommentCache(id);

  const { walletAddress: authorWalletAddress } = useUserWalletAddress(
    story?.userId,
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
  const openedChapterFor = useRef<string | null>(null);
  const viewRecordedFor = useRef<string | null>(null);

  // --- Data Loading ---

  // Best-effort background fetch of a neighbouring chapter into the cache.
  const prefetchChapter = useCallback(
    (chapters: Omit<Chapter, "content">[], index: number, authorId: string) => {
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

  const storyReady =
    !!story && story.id === id && !detailQuery.isPlaceholderData;
  const viewerReady =
    !authLoading &&
    (!uid ||
      ((viewerQuery.isSuccess || viewerQuery.isError) &&
        !viewerQuery.isFetching));

  useEffect(() => {
    if (!storyReady || !story || viewRecordedFor.current === story.id) return;
    viewRecordedFor.current = story.id;
    void publicStoryRepo.recordView(story.id).catch(() => {});
  }, [storyReady, story]);

  useEffect(() => {
    if (!storyReady || !viewerReady || !story) return;
    if (openedChapterFor.current === story.id) return;
    openedChapterFor.current = story.id;
    resumeRef.current = uid ? (viewerQuery.data?.progress ?? null) : null;
    const resumeId = resumeRef.current?.chapterId;
    const saved = resumeId
      ? chapters.findIndex((chapter) => chapter.id === resumeId)
      : -1;
    const index = Math.max(0, Math.min(saved, chapters.length - 1));
    setState((prev) => ({
      ...prev,
      currentChapter: null,
      currentChapterIndex: index,
    }));
    void loadChapterContent(index, chapters, story.userId);
  }, [
    storyReady,
    viewerReady,
    story,
    chapters,
    uid,
    viewerQuery.data,
    loadChapterContent,
  ]);

  const patchStory = useCallback(
    (update: (story: Story) => Story) => {
      if (!id) return;
      queryClient.setQueryData<PublicStoryDetail | null>(
        queryKeys.stories.detail(id),
        (detail) =>
          detail ? { ...detail, story: update(detail.story) } : detail,
      );
    },
    [id, queryClient],
  );

  const holdStoryQueries = useCallback(async () => {
    if (!id) return;
    await Promise.all([
      queryClient.cancelQueries({ queryKey: queryKeys.stories.detail(id) }),
      uid
        ? queryClient.cancelQueries({
            queryKey: queryKeys.stories.viewer(id, uid),
          })
        : undefined,
    ]);
  }, [id, uid, queryClient]);

  const refreshViewer = useCallback(() => {
    if (!id || !uid) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.stories.viewer(id, uid),
    });
  }, [id, uid, queryClient]);

  const patchViewer = useCallback(
    (update: (viewer: StoryViewer) => StoryViewer) => {
      if (!id || !uid) return;
      queryClient.setQueryData<StoryViewer>(
        queryKeys.stories.viewer(id, uid),
        (viewer) => (viewer ? update(viewer) : viewer),
      );
    },
    [id, uid, queryClient],
  );

  // --- Handlers ---
  const handleLike = useCallback(async () => {
    if (!id || !uid) return;

    const previousIsLiked = isLiked;
    const previousLikes = likes;

    await holdStoryQueries();
    patchViewer((viewer) => ({ ...viewer, liked: !previousIsLiked }));
    patchStory((story) => ({
      ...story,
      likes: previousIsLiked
        ? Math.max(0, previousLikes - 1)
        : previousLikes + 1,
    }));

    try {
      const social = await storySocialRepo.setLike(id, !previousIsLiked);
      patchStory((story) => ({ ...story, likes: social.likeCount }));
    } catch (error) {
      console.error("Error toggling like:", error);
      patchViewer((viewer) => ({ ...viewer, liked: previousIsLiked }));
      patchStory((story) => ({ ...story, likes: previousLikes }));
    } finally {
      refreshViewer();
    }
  }, [
    id,
    uid,
    isLiked,
    likes,
    holdStoryQueries,
    patchStory,
    patchViewer,
    refreshViewer,
  ]);

  const handleRatingSubmit = useCallback(
    async (rating: number) => {
      if (!id || !uid) return;
      if (userRating !== null) return;

      const previousRatingsCount = ratingsCount;
      const previousAverageRating = story?.averageRating;

      await holdStoryQueries();
      patchViewer((viewer) => ({ ...viewer, rating }));
      patchStory((story) => ({
        ...story,
        ratingsCount: previousRatingsCount + 1,
      }));

      try {
        const social = await storySocialRepo.createRating(id, rating);
        patchStory((story) => ({
          ...story,
          averageRating: social.averageRating,
          ratingsCount: social.ratingsCount,
        }));
      } catch (error) {
        console.error("Error submitting rating:", error);
        patchViewer((viewer) => ({ ...viewer, rating: null }));
        patchStory((story) => ({
          ...story,
          averageRating: previousAverageRating,
          ratingsCount: previousRatingsCount,
        }));
      } finally {
        refreshViewer();
      }
    },
    [
      id,
      uid,
      userRating,
      ratingsCount,
      story,
      holdStoryQueries,
      patchStory,
      patchViewer,
      refreshViewer,
    ],
  );

  const handlePrevChapter = useCallback(() => {
    const prevIndex = Math.max(state.currentChapterIndex - 1, 0);
    const chapterMeta = chapters[prevIndex];
    const cached = chapterMeta
      ? chapterContentCache.current[chapterMeta.id]
      : null;

    // Record the target so any in-flight fetch for another chapter is dropped.
    if (chapterMeta) activeChapterId.current = chapterMeta.id;

    if (id && uid && story) {
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

    if (!cached) loadChapterContent(prevIndex, chapters, story?.userId || "");
  }, [id, uid, state.currentChapterIndex, chapters, story, loadChapterContent]);

  const handleNextChapter = useCallback(() => {
    const nextIndex = Math.min(
      state.currentChapterIndex + 1,
      chapters.length - 1,
    );
    const chapterMeta = chapters[nextIndex];
    const cached = chapterMeta
      ? chapterContentCache.current[chapterMeta.id]
      : null;

    // Record the target so any in-flight fetch for another chapter is dropped.
    if (chapterMeta) activeChapterId.current = chapterMeta.id;

    if (id && uid && story) {
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

    if (!cached) loadChapterContent(nextIndex, chapters, story?.userId || "");
  }, [id, uid, state.currentChapterIndex, chapters, story, loadChapterContent]);

  const handleRetryChapter = useCallback(() => {
    loadChapterContent(
      state.currentChapterIndex,
      chapters,
      story?.userId || "",
    );
  }, [loadChapterContent, state.currentChapterIndex, chapters, story?.userId]);

  const handleScrollPersist = useCallback(
    (percent: number) => {
      if (!id || !uid) return;
      if (state.currentChapter)
        readingHistoryRepo.saveProgress(id, state.currentChapter.id, percent);
    },
    [id, uid, state.currentChapter],
  );

  // --- Comment Logic ---
  // Each write returns the affected comment, so the thread is patched in place
  // rather than re-fetched whole.
  const handleCreateComment = useCallback(
    async (message: string) => {
      if (!id) return;
      upsertComment(await storySocialRepo.createComment(id, message));
    },
    [id, upsertComment],
  );

  const handleReply = useCallback(
    async (parentId: string, message: string) => {
      if (!id) return;
      try {
        upsertComment(
          await storySocialRepo.createComment(id, message, parentId),
        );
      } catch (error) {
        console.error("Error adding reply:", error);
      }
    },
    [id, upsertComment],
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!id) return;
      try {
        await storySocialRepo.deleteComment(id, commentId);
        removeComment(commentId);
      } catch (error) {
        console.error("Error deleting comment:", error);
      }
    },
    [id, removeComment],
  );

  const handleEdit = useCallback(
    async (commentId: string, newMessage: string) => {
      if (!id) return;
      try {
        upsertComment(
          await storySocialRepo.updateComment(id, commentId, newMessage),
        );
      } catch (error) {
        console.error("Error updating comment:", error);
      }
    },
    [id, upsertComment],
  );

  const handleCommentLike = useCallback(
    async (commentId: string, liked: boolean) => {
      if (!id) return;
      try {
        upsertComment(
          await storySocialRepo.setCommentLike(id, commentId, liked),
        );
      } catch (error) {
        console.error("Error updating comment like:", error);
      }
    },
    [id, upsertComment],
  );

  // --- Render ---
  if (detailQuery.isPending) {
    return <StoryLoadingState />;
  }

  if (detailQuery.isError || !story) {
    return (
      <StoryErrorState
        error={detailQuery.isError ? "Failed to load story" : "Story not found"}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  // --- VIEW 1: DETAILS ---
  if (viewMode === "details") {
    const genres = story.tags || ["Fiction", "Adventure", "Fantasy"];
    const storyUrl = `/story/${story.id}`;
    const storyImage = story.coverImageUrl
      ? getAbsoluteUrl(story.coverImageUrl)
      : getAbsoluteUrl("/book.svg");

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Book",
      name: story.title,
      description: story.description,
      author: {
        "@type": "Person",
        name: story.author,
      },
      image: storyImage,
      url: getAbsoluteUrl(storyUrl),
      datePublished: story.createdAt.toISOString(),
      dateModified: story.updatedAt.toISOString(),
      aggregateRating: story.averageRating
        ? {
            "@type": "AggregateRating",
            ratingValue: story.averageRating,
            ratingCount: ratingsCount || 0,
          }
        : undefined,
      keywords: genres.join(", "),
      numberOfPages: chapterCount,
    };

    const canRate = !!uid && userRating === null;
    const displayRating = userRating ?? story.averageRating ?? 0;
    const starsToShow = hoveredHeroStar ?? displayRating;

    return (
      <>
        <SEOHead
          title={story.title}
          description={story.description}
          keywords={genres}
          image={story.coverImageUrl}
          url={storyUrl}
          type="article"
          author={story.author}
          publishedTime={story.createdAt.toISOString()}
          modifiedTime={story.updatedAt.toISOString()}
          canonical={storyUrl}
          structuredData={structuredData}
        />

        <div className="min-h-screen bg-ns-bg font-body">
          {/* ── Header: cover + title side by side ── */}
          <div className="max-w-5xl mx-auto px-6 pt-28 pb-10 border-b border-ns-border">
            <div className="flex flex-col sm:flex-row gap-8 sm:gap-10 items-start">
              {/* Book cover */}
              <div className="flex-shrink-0 w-36 sm:w-44 aspect-[2/3] rounded-ns-lg shadow-ns-xl overflow-hidden ring-1 ring-ns-border/40 self-start">
                {story.coverImageUrl ? (
                  <img
                    src={story.coverImageUrl}
                    alt={story.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookCoverFallback
                    title={story.title}
                    author={story.author}
                    size="large"
                  />
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
                  {story.title}
                </h1>

                {/* Author + stats */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-6">
                  <span className="font-ui text-xs text-ns-ink-muted">by</span>
                  <Link
                    to={`/profile/${story.userId}`}
                    className="font-ui text-sm text-ns-ink hover:text-ns-accent transition-colors"
                  >
                    <AuthorName userId={story.userId} fallback={story.author} />
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
                    {ratingsCount > 0
                      ? `${ratingsCount} ${ratingsCount === 1 ? "rating" : "ratings"}`
                      : "No ratings yet"}
                  </span>
                  <span className="text-ns-border select-none">·</span>
                  <span className="font-ui text-xs text-ns-ink-muted">
                    {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      const chapter = chapters[state.currentChapterIndex];
                      if (id && uid && chapter) {
                        const resume = resumeRef.current;
                        readingHistoryRepo.saveProgress(
                          id,
                          chapter.id,
                          resume?.chapterId === chapter.id
                            ? resume.scrollPercent
                            : 0,
                        );
                      }
                      setViewMode("reader");
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-ns-accent text-white font-ui text-sm font-medium rounded-ns shadow-ns-sm hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150"
                  >
                    <BookOpen className="w-4 h-4" />
                    Read Now
                  </button>
                  <button
                    onClick={handleLike}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-ns border font-ui text-sm transition-all duration-150 active:scale-[0.97] ${
                      isLiked
                        ? "border-ns-accent text-ns-accent bg-ns-accent-subtle"
                        : "border-ns-border text-ns-ink-secondary hover:border-ns-border-strong hover:text-ns-ink hover:bg-ns-surface-hover"
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 transition-all ${isLiked ? "fill-current" : ""}`}
                    />
                    {likes} {likes === 1 ? "Like" : "Likes"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="max-w-5xl mx-auto px-6 py-12">
            <main className="max-w-2xl mx-auto">
              <StorySynopsis description={story.description} />

              {/* Ornamental divider */}
              <div className="flex items-center gap-4 my-10">
                <div className="flex-1 h-px bg-ns-border" />
                <span className="text-ns-ink-muted text-xs select-none">✦</span>
                <div className="flex-1 h-px bg-ns-border" />
              </div>

              <StoryAuthorBio
                author={story.author}
                authorId={story.userId}
                authorWalletAddress={authorWalletAddress || undefined}
                storyId={id!}
              />

              <div className="flex items-center gap-4 my-10">
                <div className="flex-1 h-px bg-ns-border" />
                <span className="text-ns-ink-muted text-xs select-none">✦</span>
                <div className="flex-1 h-px bg-ns-border" />
              </div>

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
      totalChapters={chapters.length}
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
