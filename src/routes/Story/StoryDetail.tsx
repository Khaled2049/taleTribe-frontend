import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Link,
  useLocation,
  useMatch,
  useNavigate,
  useParams,
} from "react-router-dom";
import { publicStoryRepo } from "@novelsync/story-data-client";
import { Chapter, Story } from "@novelsync/story-data-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  publicChapterQuery,
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
import { StoryDetailSkeleton } from "./StoryDetailSkeleton";
import { ReaderSkeleton } from "./components/reader/ReaderSkeleton";
import { StoryErrorState } from "./components/StoryErrorState";
import { StorySynopsis } from "./components/StorySynopsis";
import { BookOpen, Heart } from "lucide-react";
import { StoryAuthorBio } from "./components/StoryAuthorBio";
import { StoryCommentsSection } from "./components/StoryCommentsSection";
import { ChapterReader } from "./components/reader/ChapterReader";
import { SEOHead } from "@/components/seo/SEOHead";
import { BookCoverFallback } from "@/components/story/BookCoverFallback";
import {
  chapterPath,
  storyIdFromParam,
  storyPath,
  tagPath,
} from "@/lib/seoPaths";
import { readingHistoryRepo } from "@novelsync/story-data-client";

const NO_CHAPTERS: Omit<Chapter, "content">[] = [];

type ViewMode = "details" | "reader";

const onIdle = (run: () => void) => {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run);
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 200);
  return () => window.clearTimeout(handle);
};

const StoryDetail: React.FC = () => {
  // The param is "<slug>-<uuid>"; only the uuid identifies the story.
  const { id: routeParam } = useParams<{ id: string }>();
  const id = storyIdFromParam(routeParam);
  const { user } = useAuthContext();
  const { uid, loading: authLoading } = useAuthIdentity();
  const queryClient = useQueryClient();

  const navigate = useNavigate();
  const location = useLocation();
  const readerMatch = useMatch("/story/:id/read/:chapterId?");
  const viewMode: ViewMode = readerMatch ? "reader" : "details";
  const routeChapterId = readerMatch?.params.chapterId;
  const [hoveredHeroStar, setHoveredHeroStar] = useState<number | null>(null);

  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [openedStoryId, setOpenedStoryId] = useState<string | null>(null);

  const detailQuery = usePublicStory(id);
  const viewerQuery = useStoryViewer(id, uid);
  const story = detailQuery.data?.story ?? null;
  const base = story
    ? storyPath(story.id, story.title)
    : `/story/${routeParam}`;
  const chapters = detailQuery.data?.chapters ?? NO_CHAPTERS;
  const routeIndex = routeChapterId
    ? chapters.findIndex((chapter) => chapter.id === routeChapterId)
    : -1;
  const activeIndex =
    viewMode === "reader" && routeIndex >= 0 ? routeIndex : currentChapterIndex;
  const chapterCount = detailQuery.isPlaceholderData
    ? (story?.chapterCount ?? 0)
    : chapters.length;
  const likes = story?.likes ?? 0;
  const ratingsCount = story?.ratingsCount ?? 0;
  const isLiked = uid ? (viewerQuery.data?.liked ?? false) : false;
  const userRating = uid ? (viewerQuery.data?.rating ?? null) : null;

  const { data: comments = [], isPending: commentsLoading } = useComments(id);
  const { upsert: upsertComment, remove: removeComment } = useCommentCache(id);

  // Saved resume position (chapter + scroll), captured on load.
  const resumeRef = useRef<{
    chapterId: string | null;
    scrollPercent: number;
  } | null>(null);
  const viewRecordedFor = useRef<string | null>(null);

  const chapterMeta =
    story && openedStoryId === story.id ? chapters[activeIndex] : undefined;
  const chapterQuery = useQuery({
    ...publicChapterQuery(id ?? "", chapterMeta?.id ?? "", story?.userId ?? ""),
    enabled: !!id && !!story && !!chapterMeta,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === id ? previous : undefined,
  });
  const currentChapter = chapterQuery.data ?? null;
  const chapterLoading =
    !!chapterMeta &&
    (chapterQuery.isPlaceholderData ||
      (chapterQuery.isFetching && !chapterQuery.data));
  const chapterError = chapterQuery.isError
    ? "Failed to load this chapter. Please try again."
    : chapterQuery.data === null
      ? "This chapter could not be found."
      : null;

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
    if (openedStoryId === story.id) return;
    resumeRef.current = uid ? (viewerQuery.data?.progress ?? null) : null;
    const resumeId = resumeRef.current?.chapterId;
    const saved = resumeId
      ? chapters.findIndex((chapter) => chapter.id === resumeId)
      : -1;
    setCurrentChapterIndex(Math.max(0, Math.min(saved, chapters.length - 1)));
    setOpenedStoryId(story.id);
  }, [
    storyReady,
    viewerReady,
    story,
    chapters,
    uid,
    viewerQuery.data,
    openedStoryId,
  ]);

  useEffect(() => {
    if (viewMode !== "reader" || !id || !story || !currentChapter) return;
    if (chapterLoading) return;
    const neighbours = [
      chapters[activeIndex + 1],
      chapters[activeIndex - 1],
    ].filter((meta): meta is Omit<Chapter, "content"> => !!meta);
    return onIdle(() => {
      for (const meta of neighbours) {
        void queryClient.prefetchQuery(
          publicChapterQuery(id, meta.id, story.userId),
        );
      }
    });
  }, [
    viewMode,
    id,
    story,
    chapters,
    activeIndex,
    currentChapter,
    chapterLoading,
    queryClient,
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

  const goToChapter = useCallback(
    (index: number) => {
      const target = chapters[index];
      if (!target) return;
      if (id && uid) readingHistoryRepo.saveProgress(id, target.id);
      setCurrentChapterIndex(index);
      navigate(`${base}/read/${target.id}`, {
        replace: true,
        state: location.state,
      });
    },
    [id, base, uid, chapters, navigate, location.state],
  );

  const handlePrevChapter = useCallback(
    () => goToChapter(Math.max(activeIndex - 1, 0)),
    [goToChapter, activeIndex],
  );

  const handleNextChapter = useCallback(
    () => goToChapter(Math.min(activeIndex + 1, chapters.length - 1)),
    [goToChapter, activeIndex, chapters.length],
  );

  const handleBackToDetails = useCallback(() => {
    if ((location.state as { fromDetails?: boolean } | null)?.fromDetails) {
      navigate(-1);
    } else {
      navigate(base, { replace: true });
    }
  }, [location.state, navigate, base]);

  // A bare-id or renamed-story URL is moved to the canonical one, matching the
  // 301 the server gives a crawler, so a copied link is always the canonical.
  useEffect(() => {
    if (!storyReady || !story) return;
    const current = `/story/${routeParam}`;
    const canonical = storyPath(story.id, story.title);
    if (current === canonical || !location.pathname.startsWith(current)) return;
    navigate(
      canonical +
        location.pathname.slice(current.length) +
        location.search +
        location.hash,
      { replace: true, state: location.state },
    );
  }, [storyReady, story, routeParam, location, navigate]);

  useEffect(() => {
    if (viewMode !== "reader" || !id || !story) return;
    if (openedStoryId !== story.id) return;
    if (routeIndex >= 0) {
      if (routeIndex !== currentChapterIndex)
        setCurrentChapterIndex(routeIndex);
      return;
    }
    const target = chapters[currentChapterIndex];
    if (target) {
      navigate(`${base}/read/${target.id}`, {
        replace: true,
        state: location.state,
      });
    }
  }, [
    viewMode,
    id,
    base,
    story,
    openedStoryId,
    routeIndex,
    currentChapterIndex,
    chapters,
    navigate,
    location.state,
  ]);

  const { refetch: refetchChapter } = chapterQuery;
  const handleRetryChapter = useCallback(() => {
    void refetchChapter();
  }, [refetchChapter]);

  const handleScrollPersist = useCallback(
    (percent: number) => {
      if (!id || !uid) return;
      if (currentChapter)
        readingHistoryRepo.saveProgress(id, currentChapter.id, percent);
    },
    [id, uid, currentChapter],
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
  if (!id) {
    return (
      <>
        <SEOHead title="Story not found" noindex />
        <StoryErrorState
          error="Story not found"
          onRetry={() => navigate("/stories")}
        />
      </>
    );
  }

  if (detailQuery.isPending) {
    return <StoryDetailSkeleton />;
  }

  if (detailQuery.isError || !story) {
    return (
      <>
        <SEOHead title="Story not found" noindex />
        <StoryErrorState
          error={
            detailQuery.isError ? "Failed to load story" : "Story not found"
          }
          onRetry={() => void detailQuery.refetch()}
        />
      </>
    );
  }

  // --- VIEW 1: DETAILS ---
  if (viewMode === "details") {
    const genres = story.tags || ["Fiction", "Adventure", "Fantasy"];
    const canRate = !!uid && userRating === null;
    const displayRating = userRating ?? story.averageRating ?? 0;
    const starsToShow = hoveredHeroStar ?? displayRating;

    return (
      <>
        {/* JSON-LD for this page is written by the seoRender Function. */}
        <SEOHead
          title={`${story.title} by ${story.author}`}
          description={
            story.description || `Read ${story.title} by ${story.author}.`
          }
          keywords={genres}
          image={story.coverImageUrl}
          url={base}
          type="book"
          author={story.author}
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
                    alt={`Cover of ${story.title}`}
                    width={352}
                    height={528}
                    fetchPriority="high"
                    decoding="async"
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
                    <Link
                      key={g}
                      to={tagPath(g)}
                      className="px-2.5 py-0.5 rounded-full border border-ns-border font-ui text-[10px] uppercase tracking-widest text-ns-ink-muted no-underline transition-colors hover:border-ns-border-strong hover:text-ns-ink"
                    >
                      {g}
                    </Link>
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
                    {story.author}
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
                  {/* A real link, so the first chapter is reachable by a crawler. */}
                  <Link
                    to={
                      chapters[activeIndex]
                        ? `${base}/read/${chapters[activeIndex].id}`
                        : `${base}/read`
                    }
                    state={{ fromDetails: true }}
                    onClick={() => {
                      const chapter = chapters[activeIndex];
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
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-ns-accent text-white font-ui text-sm font-medium rounded-ns shadow-ns-sm no-underline hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150"
                  >
                    <BookOpen className="w-4 h-4" />
                    Read Now
                  </Link>
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
                bio={detailQuery.data?.author.bio}
                photoURL={detailQuery.data?.author.photoUrl}
                authorWalletAddress={detailQuery.data?.author.walletAddress}
                storyId={id}
                loading={detailQuery.isPlaceholderData}
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
  if (!currentChapter && chapterError && !chapterLoading) {
    return (
      <>
        <SEOHead title="Chapter not found" noindex />
        <StoryErrorState error={chapterError} onRetry={handleRetryChapter} />
      </>
    );
  }

  if (!currentChapter) {
    return (
      <ReaderSkeleton
        title={chapters.length > 1 ? chapters[activeIndex]?.title : undefined}
      />
    );
  }

  // Only the resumed chapter restores scroll; everything else starts at top.
  // useScrollProgress guards against restoring more than once per chapter entry.
  const resumeScrollPercent =
    resumeRef.current &&
    currentChapter.id === resumeRef.current.chapterId &&
    resumeRef.current.scrollPercent > 0
      ? resumeRef.current.scrollPercent
      : null;

  return (
    <>
      <SEOHead
        title={`${currentChapter.title} — ${story.title}`}
        description={
          // The opening lines, matching what the server wrote for crawlers.
          currentChapter.content
            .slice(0, 2000)
            .replace(/<[^>]*>/g, " ")
            .trim() ||
          `Read ${currentChapter.title} of ${story.title} by ${story.author}.`
        }
        image={story.coverImageUrl}
        url={chapterPath(story.id, story.title, currentChapter.id)}
        type="article"
        author={story.author}
        // Without a chapter in the URL this is a redirect in progress.
        noindex={!routeChapterId}
      />
      <ChapterReader
        currentChapter={currentChapter}
        currentChapterIndex={activeIndex}
        totalChapters={chapters.length}
        chapterLoading={chapterLoading}
        chapterError={chapterError}
        onRetryChapter={handleRetryChapter}
        onBackToDetails={handleBackToDetails}
        onPrevChapter={handlePrevChapter}
        onNextChapter={handleNextChapter}
        paragraphStyle={story.paragraphStyle}
        resumeScrollPercent={resumeScrollPercent}
        onScrollPersist={handleScrollPersist}
      />
    </>
  );
};

export default StoryDetail;
