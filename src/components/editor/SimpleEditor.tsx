import "../style.css";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  BookPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader,
  Maximize2,
  Minimize2,
  PenLine,
  Save,
  ScrollText,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuthContext } from "../../contexts/AuthContext";
import {
  StoryDataConflictError,
  storyWorkspaceRepo,
} from "@novelsync/story-data-client";
import {
  Chapter,
  ChapterSummary,
  ParagraphStyle,
  Story,
} from "@novelsync/story-data-client";
import { useAuthIdentity } from "@novelsync/platform-auth";

// Import components
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { EditorCanvasSkeleton } from "@/components/editor/EditorWorkspaceSkeleton";
import {
  ConfirmDialog,
  SlideOverPanel,
  UnsavedChangesDialog,
} from "@/components/common";
import { Editor } from "@tiptap/react";

// Import hooks
import { useEditorState } from "@/hooks/useEditorState";
import { useAutosave } from "@/hooks/useAutosave";
import { SaveCancelledError } from "@/lib/saveQueue";
import { SaveStatusIndicator } from "@/components/editor/SaveStatusIndicator";
import { useDocumentStructure } from "@/components/editor/useLiveEditorState";
import { FormatToolbar } from "@/components/editor/FormatToolbar";
import { loadEditorFonts } from "@/components/editor/editorFonts";
import { useEditorZoom } from "@/components/editor/editorZoom";
import { SaveConflictDialog } from "@/components/editor/SaveConflictDialog";
import { isRetryableSaveError, saveStoryEdits } from "@/lib/storySave";
import { WordCount } from "@/components/editor/WordCount";
import { WritingGoal } from "@/components/editor/WritingGoal";
import { useWritingGoalTracker } from "@/hooks/useWritingGoalTracker";
import { sidebarShortcut, sidebarShortcutLabel } from "@/lib/sidebarShortcut";
import {
  getDocumentOutline,
  jumpToOutlineEntry,
  splitDocumentAtHeadings,
  type DocumentSection,
  type OutlineEntry,
} from "@/utils/documentOutline";
import {
  CHAPTER_TITLE_LIMIT,
  CHAPTER_WORD_LIMIT,
  STORY_CHAPTER_LIMIT,
  chapterWordCount,
} from "@/utils/chapterWordLimit";
import { nextChapterPosition } from "@/utils/chapterPosition";
import { loadWorkspace } from "@/lib/workspaceLoad";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
// Co-Write only renders when opened; `?wizard=true` opens it on mount.
const loadInteractiveStoryPanel = () =>
  import("@/components/editor/InteractiveStoryPanel");
const InteractiveStoryPanel = lazy(() =>
  loadInteractiveStoryPanel().then((m) => ({
    default: m.InteractiveStoryPanel,
  })),
);
const preloadCoWrite = () => void loadInteractiveStoryPanel().catch(() => {});
import { useCoWrite } from "@/hooks/useCoWrite";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useFocusModeStore } from "@/stores/focusModeStore";
import { toast } from "sonner";
import { summarizeChapter } from "@/cloudFunctions/ai";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queries/queryKeys";
import {
  workspaceChapterIndexQuery,
  workspaceChapterQuery,
  workspaceStoryQuery,
} from "@/hooks/queries/workspaceStory";
import { neighbourChapterIds } from "@/lib/chapterIndex";
import { useEditorBridge } from "@/components/editor/EditorBridge";

function splitValidationError(sections: DocumentSection[]): string | null {
  if (sections.length < 2) {
    return "Add another top-level heading before splitting.";
  }
  if (sections.length > STORY_CHAPTER_LIMIT) {
    return `A story can have at most ${STORY_CHAPTER_LIMIT} chapters. Remove some headings first.`;
  }
  if (
    sections.some(
      (section) => chapterWordCount(section.html) > CHAPTER_WORD_LIMIT,
    )
  ) {
    return `Each section must be under ${CHAPTER_WORD_LIMIT.toLocaleString()} words before splitting.`;
  }
  if (
    sections.some((section) => [...section.title].length > CHAPTER_TITLE_LIMIT)
  ) {
    return `Chapter headings must be ${CHAPTER_TITLE_LIMIT} characters or fewer.`;
  }
  return null;
}

export function SimpleEditor() {
  const { storyId } = useParams<{ storyId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const openInteractivePanelOnMount = searchParams.get("wizard") === "true";
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const { uid } = useAuthIdentity();

  // Use the new consolidated state hook
  const { state, actions } = useEditorState();
  const { isLgUp } = useBreakpoint();
  const [isPublishing, setIsPublishing] = useState(false);

  // Network status
  const { isOnline } = useNetworkStatus();

  // Editor instance for header
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorBridge = useEditorBridge();
  const chapterBaseRef = useRef<Chapter | null>(null);
  const storyBaseRef = useRef<Story | null>(null);
  const chapterDirtyRef = useRef(false);
  const storyDirtyRef = useRef(false);
  // A style the writer picked that the story row does not carry yet.
  const paragraphStyleRef = useRef<ParagraphStyle | null>(null);
  const [pendingParagraphStyle, setPendingParagraphStyle] =
    useState<ParagraphStyle | null>(null);
  const chapterTitleRef = useRef("");
  const storyTitleRef = useRef("");
  const dirtyRef = useRef(false);
  const flushAndWaitRef = useRef<() => Promise<number | undefined>>(
    async () => undefined,
  );
  const bridgeRegistrationRef = useRef<{
    transaction: (transaction: import("@tiptap/pm/state").Transaction) => void;
    revisionChanged: () => void;
    unregister: () => void;
  } | null>(null);
  const {
    isInteractivePanelOpen,
    setIsInteractivePanelOpen,
    interactivePanelMode,
    setInteractivePanelMode,
    coWriteTurnCount,
    setCoWriteTurnCount,
    openCoWrite,
  } = useCoWrite({ openInteractivePanelOnMount, editor });

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState<string | null>(null);
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] =
    useState(false);
  const [pendingChapter, setPendingChapter] = useState<ChapterSummary | null>(
    null,
  );
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);

  useEffect(loadEditorFonts, []);
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null);
  const { zoom, setZoom, zoomPercent } = useEditorZoom(canvas);

  const focusMode = useFocusModeStore((s) => s.focusMode);
  const setFocusMode = useFocusModeStore((s) => s.setFocusMode);
  const leftSidebarBeforeFocus = useRef<boolean | null>(null);
  const {
    isFullscreen,
    isSupported: isFullscreenSupported,
    enter: enterFullscreen,
    exit: exitFullscreen,
  } = useFullscreen();

  const enterFocusMode = useCallback(() => {
    leftSidebarBeforeFocus.current = state.leftSidebarOpen;
    actions.setLeftSidebarOpen(false);
    setFocusMode(true);
    void enterFullscreen();
  }, [state.leftSidebarOpen, actions, enterFullscreen, setFocusMode]);

  const exitFocusMode = useCallback(() => {
    const previous = leftSidebarBeforeFocus.current;
    leftSidebarBeforeFocus.current = null;
    setFocusMode(false);
    if (previous !== null) actions.setLeftSidebarOpen(previous);
    void exitFullscreen();
  }, [actions, exitFullscreen, setFocusMode]);

  const wasFullscreen = useRef(false);
  useEffect(() => {
    const left = wasFullscreen.current && !isFullscreen;
    wasFullscreen.current = isFullscreen;
    if (left && focusMode) exitFocusMode();
  }, [isFullscreen, focusMode, exitFocusMode]);

  useEffect(() => {
    return () => {
      setFocusMode(false);
      void exitFullscreen();
    };
  }, [setFocusMode, exitFullscreen]);

  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (
        deleteDialogOpen ||
        publishDialogOpen ||
        unsavedChangesDialogOpen ||
        summaryResult
      ) {
        return;
      }
      exitFocusMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    focusMode,
    deleteDialogOpen,
    publishDialogOpen,
    unsavedChangesDialogOpen,
    summaryResult,
    exitFocusMode,
  ]);

  useEffect(() => {
    if (isLgUp) {
      return;
    }
    actions.setLeftSidebarOpen(false);
  }, [isLgUp, actions]);

  const cacheChapter = useCallback(
    (chapter: Chapter) => {
      if (!uid || !storyId) return;
      queryClient.setQueryData(
        workspaceChapterQuery(uid, storyId, chapter.id).queryKey,
        chapter,
      );
    },
    [queryClient, storyId, uid],
  );

  // Keeps the workspace query in step, so revisiting the editor does not
  // restore a title or publish state this session already changed.
  const replaceStory = useCallback(
    (saved: Story) => {
      storyBaseRef.current = saved;
      actions.replaceStory(saved);
      if (uid) {
        queryClient.setQueryData(
          workspaceStoryQuery(uid, saved.id).queryKey,
          saved,
        );
      }
    },
    [actions, queryClient, uid],
  );

  const [conflictChapterId, setConflictChapterId] = useState<string | null>(
    null,
  );
  const [resolvingConflict, setResolvingConflict] = useState(false);

  const adoptChapter = useCallback((chapter: Chapter | null) => {
    chapterBaseRef.current = chapter;
    chapterDirtyRef.current = false;
  }, []);

  const performSave = useCallback(
    async (content: string) => {
      if (!storyBaseRef.current) throw new Error("No story selected");
      const base = chapterBaseRef.current;
      if (base && chapterDirtyRef.current) {
        chapterDirtyRef.current = false;
        try {
          const savedChapter = await storyWorkspaceRepo.updateChapter(
            storyBaseRef.current,
            base,
            chapterTitleRef.current,
            content,
          );
          if (chapterBaseRef.current?.id === savedChapter.id) {
            chapterBaseRef.current = savedChapter;
          }
          actions.updateChapterInList(savedChapter.id, { ...savedChapter });
          cacheChapter(savedChapter);
          bridgeRegistrationRef.current?.revisionChanged();
        } catch (error) {
          chapterDirtyRef.current = true;
          // Retrying cannot succeed: the base revision stays stale until the
          // writer picks a version.
          if (error instanceof StoryDataConflictError) {
            setConflictChapterId(base.id);
          }
          throw error;
        }
      }

      const story = storyBaseRef.current;
      if (story && storyDirtyRef.current) {
        storyDirtyRef.current = false;
        try {
          replaceStory(
            await saveStoryEdits(storyWorkspaceRepo, story, {
              title: storyTitleRef.current,
              ...(paragraphStyleRef.current
                ? { paragraphStyle: paragraphStyleRef.current }
                : {}),
            }),
          );
        } catch (error) {
          storyDirtyRef.current = true;
          throw error;
        }
      }
      return chapterBaseRef.current?.revision;
    },
    [actions, cacheChapter, replaceStory],
  );

  // Initialize autosave hook
  const {
    triggerSave,
    forceSave,
    flushAndWait,
    flushSave,
    saveState,
    isDirty,
    resetSaveState,
  } = useAutosave({
    onSave: performSave,
    debounceMs: 3000,
    enabled: !!state.story,
    shouldRetry: isRetryableSaveError,
  });

  const resolveConflict = async (choice: "mine" | "theirs") => {
    const chapterId = conflictChapterId;
    if (!chapterId || !storyId || !uid) return;
    setResolvingConflict(true);
    try {
      const latest = await storyWorkspaceRepo.getChapter(
        storyId,
        chapterId,
        uid,
      );
      if (chapterBaseRef.current?.id !== chapterId) return;
      if (!latest) {
        toast.error(
          "This chapter was deleted somewhere else. Copy your text before leaving.",
        );
        return;
      }
      if (choice === "mine") {
        chapterBaseRef.current = latest;
        chapterDirtyRef.current = true;
        setConflictChapterId(null);
        await forceSave();
        return;
      }
      adoptChapter(latest);
      editor?.commands.setContent(latest.content, { emitUpdate: false });
      actions.selectChapter(latest);
      actions.updateChapterInList(latest.id, { ...latest });
      cacheChapter(latest);
      resetSaveState();
      bridgeRegistrationRef.current?.revisionChanged();
      setConflictChapterId(null);
    } catch {
      toast.error("Couldn't load the latest version. Please try again.");
    } finally {
      setResolvingConflict(false);
    }
  };

  chapterTitleRef.current = state.chapterTitle;
  storyTitleRef.current = state.storyTitle;
  dirtyRef.current = isDirty;
  flushAndWaitRef.current = flushAndWait;
  const currentStoryId = state.story?.id;
  const currentChapterId = state.currentChapter?.id;
  useWritingGoalTracker(editor, currentChapterId);

  useLayoutEffect(() => {
    if (!editorBridge || !editor || !currentStoryId || !currentChapterId) {
      bridgeRegistrationRef.current = null;
      return;
    }
    const registration = editorBridge.register({
      storyId: currentStoryId,
      chapterId: currentChapterId,
      editor,
      getChapterTitle: () => chapterTitleRef.current,
      getPersistedRevision: () => chapterBaseRef.current?.revision,
      getDirty: () => dirtyRef.current,
      flushAndWait: () => flushAndWaitRef.current(),
    });
    bridgeRegistrationRef.current = registration;
    return () => {
      registration.unregister();
      if (bridgeRegistrationRef.current === registration) {
        bridgeRegistrationRef.current = null;
      }
    };
  }, [currentChapterId, currentStoryId, editor, editorBridge]);

  // Read at load time only: a reload discards the unsaved buffer and resets
  // autosave, so the breakpoint and profile object must not be dependencies.
  const chapterParamRef = useRef(searchParams.get("chapter"));
  chapterParamRef.current = searchParams.get("chapter");
  const isLgUpRef = useRef(isLgUp);
  useEffect(() => {
    isLgUpRef.current = isLgUp;
  }, [isLgUp]);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Keep the outgoing chapter visible but not editable while the next body
  // loads. `false` stops TipTap emitting an update, which would mark it dirty.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!state.openingChapter, false);
  }, [editor, state.openingChapter]);

  // Bodies are fetched per chapter, so warm the likeliest next selections to
  // keep switching close to the old all-in-memory speed.
  const prefetchNeighbours = useCallback(
    (chapterId: string, chapters: readonly ChapterSummary[]) => {
      if (!uid || !storyId) return;
      for (const id of neighbourChapterIds(chapters, chapterId)) {
        void queryClient.prefetchQuery(workspaceChapterQuery(uid, storyId, id));
      }
    },
    [queryClient, storyId, uid],
  );

  // Bumped by anything that picks the current chapter, so a slower open that
  // was superseded never replaces it.
  const openRequestRef = useRef(0);
  const openChapter = useCallback(
    async (summary: ChapterSummary) => {
      if (!uid || !storyId) return;
      const request = ++openRequestRef.current;
      actions.beginChapterOpen(summary);
      if (!isLgUpRef.current) actions.setLeftSidebarOpen(false);
      try {
        const chapter = await queryClient.fetchQuery(
          workspaceChapterQuery(uid, storyId, summary.id),
        );
        if (request !== openRequestRef.current) return;
        if (!chapter) throw new Error("This chapter no longer exists.");
        adoptChapter(chapter);
        actions.selectChapter(chapter);
        prefetchNeighbours(chapter.id, state.chapters);
      } catch (error) {
        if (request !== openRequestRef.current) return;
        actions.chapterOpenFailed();
        toast.error(
          error instanceof Error
            ? error.message
            : "Couldn't open that chapter.",
        );
      }
    },
    [
      actions,
      adoptChapter,
      prefetchNeighbours,
      queryClient,
      state.chapters,
      storyId,
      uid,
    ],
  );

  useEffect(() => {
    if (!storyId || !uid) return;
    let cancelled = false;
    actions.setLoading(true);
    resetSaveState();

    // The guard started the story and index reads under the same keys, so
    // these normally join its requests rather than issuing new ones.
    const reader = {
      getStory: (id: string) =>
        queryClient.fetchQuery(workspaceStoryQuery(uid, id)),
      getChapterIndex: (id: string) =>
        queryClient.fetchQuery(workspaceChapterIndexQuery(uid, id)),
      getChapter: (id: string, chapterId: string) =>
        queryClient.fetchQuery(workspaceChapterQuery(uid, id, chapterId)),
    };

    loadWorkspace(reader, storyId, chapterParamRef.current).then((result) => {
      queryClient.removeQueries({
        queryKey: workspaceChapterIndexQuery(uid, storyId).queryKey,
      });
      if (cancelled) return;
      if (result.status === "loaded") {
        storyBaseRef.current = result.story;
        paragraphStyleRef.current = null;
        setPendingParagraphStyle(null);
        storyDirtyRef.current = false;
        adoptChapter(result.currentChapter);
        actions.loadStory(
          result.story,
          result.chapters,
          result.currentChapter,
          {
            leftSidebarOpen: isLgUpRef.current,
          },
        );
        if (result.currentChapter) {
          prefetchNeighbours(result.currentChapter.id, result.chapters);
        }
        return;
      }
      if (result.status === "error") {
        console.error("Error loading story:", result.error);
      }
      actions.loadFailed(result.status);
    });

    return () => {
      cancelled = true;
    };
  }, [
    storyId,
    uid,
    loadAttempt,
    actions,
    adoptChapter,
    queryClient,
    resetSaveState,
    prefetchNeighbours,
  ]);

  const loadedStoryId = state.story?.id;
  const assistantNavigationPending =
    (location.state as { assistantChapterId?: unknown } | null)
      ?.assistantChapterId !== undefined;
  useEffect(() => {
    if (!currentChapterId || loadedStoryId !== storyId) return;
    if (assistantNavigationPending) return;
    if (searchParams.get("chapter") === currentChapterId) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("chapter", currentChapterId);
        return next;
      },
      { replace: true },
    );
  }, [
    assistantNavigationPending,
    currentChapterId,
    loadedStoryId,
    searchParams,
    setSearchParams,
    storyId,
  ]);

  // The shelf renders a chapter count derived server-side, so adding or
  // removing a chapter here makes its cached list wrong. The query is not
  // mounted while the editor is open, so this only marks it stale — the
  // refetch happens when the user actually navigates to the shelf.
  const invalidateShelf = useCallback(() => {
    if (!user) return;
    queryClient.invalidateQueries({
      queryKey: queryKeys.user.stories(user.uid),
    });
  }, [queryClient, user]);

  // Anything that leaves the chapter or acts on its stored text must wait for
  // a durable save, and stay put if it fails.
  const saveBeforeContinuing = useCallback(async () => {
    try {
      await flushAndWait();
      return true;
    } catch (error) {
      if (!(error instanceof SaveCancelledError)) {
        toast.error("Couldn't save your changes. Please try again.");
      }
      return false;
    }
  }, [flushAndWait]);

  // Handle new chapter creation
  const handleNewChapter = async () => {
    if (!state.story) return;
    if (!(await saveBeforeContinuing())) return;

    try {
      const newChapter = await storyWorkspaceRepo.createChapter(
        state.story,
        "New Chapter",
        nextChapterPosition(state.chapters),
      );
      openRequestRef.current += 1;
      adoptChapter(newChapter);
      actions.addChapter(newChapter);
      cacheChapter(newChapter);
      resetSaveState();
      invalidateShelf();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add chapter.",
      );
    }
  };

  const isSingleDocument = state.chapters.length === 1;
  const { outline, canSplit: canSplitIntoChapters } = useDocumentStructure(
    editor,
    isSingleDocument,
  );

  const handleOutlineSelect = (entry: OutlineEntry) => {
    if (!editor) return;
    // The subscribed outline ignores position shifts, so read the live one.
    const live = getDocumentOutline(editor)[outline.indexOf(entry)];
    jumpToOutlineEntry(editor, (live ?? entry).pos);
  };

  const splitChapterCount = splitDialogOpen
    ? splitDocumentAtHeadings(editor).length
    : 0;
  const splitPreview = `This creates ${splitChapterCount} chapters from your top-level headings. Each heading becomes a chapter title.`;

  const performSplit = async () => {
    const base = chapterBaseRef.current;
    if (!state.story || !base || !editor) return;
    const sections = splitDocumentAtHeadings(editor);
    const validationError = splitValidationError(sections);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSplitting(true);
    try {
      const [first, ...rest] = sections;
      const firstTitle = first.title || base.title || "Chapter 1";
      const basePosition = nextChapterPosition(state.chapters);
      const createdChapters: Chapter[] = [];

      for (let i = 0; i < rest.length; i++) {
        const section = rest[i];
        const created = await storyWorkspaceRepo.createChapter(
          state.story,
          section.title || `Chapter ${i + 2}`,
          basePosition + i,
        );
        const saved = await storyWorkspaceRepo.updateChapter(
          state.story,
          created,
          section.title || `Chapter ${i + 2}`,
          section.html,
        );
        createdChapters.push(saved);
      }

      const savedFirst = await storyWorkspaceRepo.updateChapter(
        state.story,
        base,
        firstTitle,
        first.html,
      );

      actions.updateChapterInList(savedFirst.id, savedFirst);
      createdChapters.forEach(actions.addChapter);
      [savedFirst, ...createdChapters].forEach(cacheChapter);
      openRequestRef.current += 1;
      adoptChapter(savedFirst);
      actions.selectChapter(savedFirst);
      editor.commands.setContent(first.html, { emitUpdate: false });
      resetSaveState();
      invalidateShelf();
      toast.success(`Split into ${sections.length} chapters.`);
    } catch (error) {
      try {
        const chapters = await storyWorkspaceRepo.getChapterIndex(
          state.story.id,
          state.story.userId,
        );
        const summary =
          chapters.find((chapter) => chapter.id === state.currentChapter?.id) ??
          chapters[0];
        const current = summary
          ? await storyWorkspaceRepo.getChapter(
              state.story.id,
              summary.id,
              state.story.userId,
            )
          : null;
        if (current) cacheChapter(current);
        adoptChapter(current);
        actions.loadStory(state.story, chapters, current, {
          leftSidebarOpen: state.leftSidebarOpen,
        });
      } catch (refreshError) {
        console.error("Failed to refresh chapters after split:", refreshError);
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to split into chapters.",
      );
    } finally {
      setIsSplitting(false);
    }
  };

  const handleSplitRequest = async () => {
    if (!(await saveBeforeContinuing())) return;
    const validationError = splitValidationError(
      splitDocumentAtHeadings(editor),
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSplitDialogOpen(true);
  };

  // Summarize the current chapter and persist the summary.
  const handleSummarizeChapter = async () => {
    if (!state.story || !state.currentChapter) return;
    if (!(await saveBeforeContinuing())) return;

    setIsSummarizing(true);
    try {
      const result = await summarizeChapter({
        storyId: state.story.id,
        chapterId: state.currentChapter.id,
      });
      setSummaryResult(result.summary);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to summarize chapter.",
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  // Copy the generated summary to the clipboard.
  const handleCopySummary = async () => {
    if (!summaryResult) return;
    try {
      await navigator.clipboard.writeText(summaryResult);
      toast.success("Summary copied to clipboard.");
    } catch {
      toast.error("Couldn't copy summary.");
    }
  };

  // Handle publishing
  const handlePublish = async () => {
    if (!state.story) return;
    if (!(await saveBeforeContinuing())) return;
    const story = storyBaseRef.current;
    if (!story) return;

    const wasPublished = story.isPublished;

    try {
      setIsPublishing(true);
      const savedStory = await storyWorkspaceRepo.updateStory({
        ...story,
        isPublished: !wasPublished,
      });
      replaceStory(savedStory);

      if (!wasPublished) {
        toast.success(
          "Story marked published. Public discovery will be available after its migration.",
        );
      } else {
        // Just unpublished — stay in editor
        toast.success("Story unpublished.");
      }
    } catch {
      toast.error("Failed to update publish status. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle chapter selection with unsaved changes check
  const handleChapterSelect = useCallback(
    (chapter: ChapterSummary) => {
      if (chapter.id === state.currentChapter?.id && !state.openingChapter) {
        return;
      }
      if (isDirty) {
        setPendingChapter(chapter);
        setUnsavedChangesDialogOpen(true);
      } else {
        resetSaveState();
        void openChapter(chapter);
      }
    },
    [
      isDirty,
      openChapter,
      resetSaveState,
      state.currentChapter?.id,
      state.openingChapter,
    ],
  );

  // Assistant chapter navigation is an explicit route-state contract. Consume
  // it only after chapters load, then clear it before selecting so refreshes do
  // not repeat the action. The normal unsaved-changes guard still applies.
  useEffect(() => {
    const requestedChapterId = (
      location.state as { assistantChapterId?: unknown } | null
    )?.assistantChapterId;
    if (typeof requestedChapterId !== "string" || state.isLoading) return;

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
    const chapter = state.chapters.find(
      (candidate) => candidate.id === requestedChapterId,
    );
    if (chapter && chapter.id !== state.currentChapter?.id) {
      handleChapterSelect(chapter);
    }
  }, [
    handleChapterSelect,
    location.pathname,
    location.search,
    location.state,
    navigate,
    state.chapters,
    state.currentChapter?.id,
    state.isLoading,
  ]);

  const handleSaveAndContinue = async () => {
    if (!(await saveBeforeContinuing())) {
      setPendingChapter(null);
      return;
    }
    if (pendingChapter) {
      resetSaveState();
      void openChapter(pendingChapter);
    }
    setPendingChapter(null);
  };

  // Handle discard and continue
  const handleDiscardAndContinue = () => {
    if (pendingChapter) {
      resetSaveState();
      void openChapter(pendingChapter);
    }
    setPendingChapter(null);
  };

  const handleMetadataChange = () => {
    triggerSave(editor?.getHTML() ?? state.currentChapter?.content ?? "");
  };

  const handleEditorSave = (content: string) => {
    chapterDirtyRef.current = true;
    triggerSave(content);
  };

  const storedParagraphStyle = () =>
    storyBaseRef.current?.paragraphStyle ?? "spaced";

  const handleStoryTitleChange = (title: string) => {
    storyTitleRef.current = title;
    const styleChanged =
      paragraphStyleRef.current !== null &&
      paragraphStyleRef.current !== storedParagraphStyle();
    storyDirtyRef.current =
      title !== storyBaseRef.current?.title || styleChanged;
    actions.updateStoryTitle(title);
  };

  const handleParagraphStyleChange = (style: ParagraphStyle) => {
    paragraphStyleRef.current = style;
    setPendingParagraphStyle(style);
    storyDirtyRef.current =
      style !== storedParagraphStyle() ||
      storyTitleRef.current !== storyBaseRef.current?.title;
    triggerSave(editor?.getHTML() ?? state.currentChapter?.content ?? "");
  };
  const paragraphStyle =
    pendingParagraphStyle ?? state.story?.paragraphStyle ?? "spaced";

  const handleChapterTitleChange = (title: string) => {
    chapterTitleRef.current = title;
    if (title !== chapterBaseRef.current?.title) chapterDirtyRef.current = true;
    actions.updateChapterTitle(title);
  };

  // Handle chapter delete request
  const handleChapterDeleteRequest = (chapterId: string) => {
    setChapterToDelete(chapterId);
    setDeleteDialogOpen(true);
  };

  // Confirm chapter deletion
  const confirmChapterDelete = async () => {
    if (!state.story || !chapterToDelete) return;

    try {
      const chapter = state.chapters.find(
        (item) => item.id === chapterToDelete,
      );
      if (!chapter) throw new Error("Chapter not found");
      await storyWorkspaceRepo.deleteChapter(state.story, chapter);
      if (uid) {
        queryClient.removeQueries({
          queryKey: workspaceChapterQuery(uid, state.story.id, chapter.id)
            .queryKey,
        });
      }
      const next =
        state.currentChapter?.id === chapter.id
          ? state.chapters.find((item) => item.id !== chapter.id)
          : undefined;
      if (chapterBaseRef.current?.id === chapter.id) adoptChapter(null);
      actions.deleteChapter(chapterToDelete);
      resetSaveState();
      if (next) void openChapter(next);
      invalidateShelf();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete chapter.",
      );
    }
    setChapterToDelete(null);
  };

  const applyLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter link URL", previousUrl || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  useEffect(() => {
    if (focusMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // The right-hand shortcut belongs to the story assistant.
      if (sidebarShortcut(event) !== "left") return;
      event.preventDefault();
      actions.toggleLeftSidebar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode, actions]);

  const openChaptersPanel = () => {
    actions.setLeftSidebarOpen(true);
  };

  const closeChaptersPanel = () => {
    actions.setLeftSidebarOpen(false);
  };

  const isPublished = !!state.story?.isPublished;
  const sidebarPanelProps = {
    chapters: state.chapters,
    currentChapterId: state.currentChapter?.id || "",
    chapterTitle: state.chapterTitle,
    storyTitle: state.storyTitle,
    onChapterSelect: handleChapterSelect,
    onChapterDelete: handleChapterDeleteRequest,
    onChapterAdd: handleNewChapter,
    onStoryTitleChange: handleStoryTitleChange,
    onChapterTitleChange: handleChapterTitleChange,
    onMetadataChange: handleMetadataChange,
    singleDocument: isSingleDocument,
    outline,
    onOutlineSelect: handleOutlineSelect,
    canSplitIntoChapters,
    onSplitIntoChapters: handleSplitRequest,
  };

  return (
    <div className="relative w-full h-full bg-ns-bg flex overflow-hidden">
      {state.loadError ? (
        <div className="flex flex-col items-center justify-center w-full h-full gap-4 font-ui text-ns-ink">
          <p className="font-heading italic text-lg text-ns-ink-muted">
            {state.loadError === "missing"
              ? "This story no longer exists."
              : "We couldn't open your story."}
          </p>
          {state.loadError === "missing" ? (
            <Button onClick={() => navigate("/user-stories")}>
              Back to My Stories
            </Button>
          ) : (
            <Button onClick={() => setLoadAttempt((n) => n + 1)}>
              Try again
            </Button>
          )}
        </div>
      ) : state.isLoading ? (
        <EditorCanvasSkeleton />
      ) : (
        <>
          {/* ── Left Sidebar ── */}
          <div
            className={`hidden lg:block relative bg-ns-surface border-r border-ns-border transition-all duration-300 overflow-hidden flex-shrink-0 ${
              state.leftSidebarOpen ? "w-80" : "w-0"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <button
              type="button"
              onClick={actions.toggleLeftSidebar}
              aria-label="Close chapters panel"
              className="absolute top-2 right-2 z-30 rounded-ns p-1.5 text-ns-ink-muted hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-80 h-full">
              <SidebarPanel {...sidebarPanelProps} />
            </div>
          </div>

          {/* ── Left Sidebar Toggle ── */}
          <button
            onClick={actions.toggleLeftSidebar}
            aria-label={
              state.leftSidebarOpen
                ? "Collapse chapters panel"
                : "Expand chapters panel"
            }
            title={`Chapters panel (${sidebarShortcutLabel("left")})`}
            className={`${
              focusMode ? "hidden" : "hidden lg:flex"
            } absolute top-1/2 -translate-y-1/2 z-20 bg-ns-elevated border border-ns-border rounded-r-ns py-4 w-5 items-center justify-center shadow-ns-sm hover:bg-ns-surface-hover hover:shadow-ns transition-all duration-200 group`}
            style={{ left: state.leftSidebarOpen ? "320px" : "0px" }}
          >
            {state.leftSidebarOpen ? (
              <ChevronLeft className="w-3 h-3 text-ns-ink-muted group-hover:text-ns-ink transition-colors" />
            ) : (
              <ChevronRight className="w-3 h-3 text-ns-ink-muted group-hover:text-ns-ink transition-colors" />
            )}
          </button>

          {/* ── Main Editor Area ── */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div
              className={`${
                focusMode ? "hidden" : "lg:hidden flex"
              } items-center justify-between border-b border-ns-border bg-ns-surface px-3 py-2 gap-2`}
            >
              <p className="font-ui text-xs text-ns-ink-secondary truncate">
                {state.currentChapter?.title || "No chapter selected"}
              </p>
              <button
                type="button"
                onClick={openChaptersPanel}
                className="inline-flex items-center gap-1 rounded-ns border border-ns-border px-2 py-1 text-[11px] font-ui text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
              >
                <BookPlus className="h-3.5 w-3.5" />
                Chapters
              </button>
            </div>

            {state.currentChapter && editor && !focusMode && (
              <FormatToolbar
                editor={editor}
                onLink={applyLink}
                zoom={zoom}
                zoomPercent={zoomPercent}
                onZoomChange={setZoom}
                paragraphStyle={paragraphStyle}
                onParagraphStyleChange={handleParagraphStyleChange}
              />
            )}

            {/* Writing Canvas */}
            {state.currentChapter ? (
              <div className="relative flex-1 min-h-0 flex flex-col">
                <div
                  ref={setCanvas}
                  className="flex-1 overflow-y-auto bg-ns-bg"
                >
                  <div className="mx-auto min-h-full flex flex-col">
                    <TipTapEditor
                      zoom={zoomPercent}
                      paragraphStyle={paragraphStyle}
                      initialContent={state.currentChapter.content}
                      onSave={handleEditorSave}
                      onBlur={flushSave}
                      storyId={state.story?.id || ""}
                      chapterId={state.currentChapter?.id || ""}
                      userId={user?.uid}
                      onEditorReady={setEditor}
                      onTransaction={(transaction) =>
                        bridgeRegistrationRef.current?.transaction(transaction)
                      }
                      onOpenCoWrite={openCoWrite}
                    />
                  </div>
                </div>
                {state.openingChapter && (
                  <ChapterOpening title={state.openingChapter.title} overlay />
                )}
              </div>
            ) : state.openingChapter ? (
              <ChapterOpening title={state.openingChapter.title} />
            ) : (
              /* Empty state — no chapter selected */
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 animate-ns-fade-in">
                <div className="w-14 h-14 rounded-full bg-ns-accent-subtle flex items-center justify-center">
                  <PenLine className="w-6 h-6 text-ns-accent opacity-70" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-heading italic text-xl text-ns-ink-secondary">
                    Select a chapter to begin writing
                  </p>
                  <p className="font-ui text-xs text-ns-ink-muted">
                    Or create a new chapter using the button below
                  </p>
                </div>
                {state.story && (
                  <button
                    onClick={handleNewChapter}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-ns bg-ns-accent text-white font-ui text-sm font-medium hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150 shadow-ns-sm"
                  >
                    <BookPlus className="w-4 h-4" />
                    New Chapter
                  </button>
                )}
              </div>
            )}

            {state.currentChapter && (!focusMode || isInteractivePanelOpen) && (
              <div className="flex-shrink-0 border-t border-ns-border bg-ns-surface">
                {isInteractivePanelOpen && editor && (
                  <div className="border-b border-ns-border bg-transparent px-3 py-3 sm:px-4 sm:py-4">
                    <div className="mx-auto w-full max-w-4xl">
                      <Suspense
                        fallback={
                          <div className="flex items-center gap-2 font-ui text-xs text-ns-ink-muted">
                            <Loader className="w-3.5 h-3.5 animate-spin" />
                            Opening Co-Write…
                          </div>
                        }
                      >
                        <InteractiveStoryPanel
                          storyId={state.story?.id || ""}
                          chapterId={state.currentChapter?.id || ""}
                          editor={editor}
                          mode={interactivePanelMode}
                          turnCount={coWriteTurnCount}
                          onClose={() => {
                            setIsInteractivePanelOpen(false);
                            setCoWriteTurnCount(0);
                          }}
                          onChoiceInserted={() => {
                            setInteractivePanelMode("continuation");
                            setCoWriteTurnCount((n) => n + 1);
                            handleEditorSave(editor.getHTML());
                          }}
                        />
                      </Suspense>
                    </div>
                  </div>
                )}

                <div
                  className={`${
                    focusMode ? "hidden" : "hidden sm:flex"
                  } items-center gap-3 px-4 py-2`}
                >
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={enterFocusMode}
                      title={
                        isFullscreenSupported
                          ? "Focus mode — hide everything but the page"
                          : "Focus mode — hide every panel"
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink hover:border-ns-border-strong active:scale-[0.97] transition-all duration-150 whitespace-nowrap"
                    >
                      <Maximize2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="hidden lg:inline">Focus</span>
                    </button>
                    <button
                      onClick={openCoWrite}
                      onPointerEnter={preloadCoWrite}
                      onFocus={preloadCoWrite}
                      title="Co-Write with AI"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink hover:border-ns-border-strong active:scale-[0.97] transition-all duration-150 whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="hidden lg:inline">Co-Write</span>
                      <span className="lg:hidden">AI</span>
                    </button>
                    <button
                      onClick={() => {
                        if (state.currentChapter) {
                          forceSave();
                        }
                      }}
                      disabled={!isDirty || saveState.status === "saving"}
                      title="Save chapter"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border font-ui text-xs active:scale-[0.97] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed border-ns-border text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink hover:border-ns-border-strong whitespace-nowrap"
                    >
                      <Save className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="hidden lg:inline">Save</span>
                    </button>
                    <button
                      onClick={handleSummarizeChapter}
                      disabled={isSummarizing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink hover:border-ns-border-strong active:scale-[0.97] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      title="Summarize this chapter and save the summary"
                    >
                      {isSummarizing ? (
                        <Loader className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                      ) : (
                        <ScrollText className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span className="hidden lg:inline">
                        {isSummarizing ? "Summarizing…" : "Summarize"}
                      </span>
                    </button>
                  </div>

                  <div className="flex-1 flex items-center justify-center gap-4 min-w-0">
                    <SaveStatusIndicator
                      status={saveState.status}
                      lastSaved={saveState.lastSaved}
                      errorMessage={saveState.errorMessage}
                      isOnline={isOnline}
                    />
                    <WordCount editor={editor} />
                    <WritingGoal />
                  </div>

                  <div className="flex items-center justify-end flex-shrink-0">
                    <button
                      onClick={() => setPublishDialogOpen(true)}
                      disabled={isPublishing}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns font-ui text-xs font-medium active:scale-[0.97] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap ${
                        isPublished
                          ? "bg-ns-destructive text-white hover:bg-ns-destructive-hover"
                          : "bg-ns-accent text-white hover:bg-ns-accent-hover"
                      }`}
                    >
                      {isPublishing ? (
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">
                        {isPublished ? "Unpublish" : "Publish"}
                      </span>
                      <span className="sm:hidden">
                        {isPublished ? "Unpub" : "Pub"}
                      </span>
                    </button>
                  </div>
                </div>

                <div
                  className={`${
                    focusMode ? "hidden" : "sm:hidden"
                  } border-t border-ns-border px-3 py-2 space-y-2`}
                >
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                    <SaveStatusIndicator
                      status={saveState.status}
                      lastSaved={saveState.lastSaved}
                      errorMessage={saveState.errorMessage}
                      isOnline={isOnline}
                    />
                    <WordCount editor={editor} />
                    <WritingGoal />
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={enterFocusMode}
                      className="inline-flex justify-center rounded-ns border border-ns-border px-2 py-1.5 text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
                      aria-label="Enter focus mode"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={openCoWrite}
                      onPointerEnter={preloadCoWrite}
                      onFocus={preloadCoWrite}
                      className="inline-flex justify-center rounded-ns border border-ns-border px-2 py-1.5 text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
                      aria-label="Open Co-Write"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (state.currentChapter) {
                          forceSave();
                        }
                      }}
                      disabled={!isDirty || saveState.status === "saving"}
                      className="inline-flex justify-center rounded-ns border border-ns-border px-2 py-1.5 text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Save chapter"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleSummarizeChapter}
                      disabled={isSummarizing}
                      className="inline-flex justify-center rounded-ns border border-ns-border px-2 py-1.5 text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Summarize chapter"
                    >
                      {isSummarizing ? (
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ScrollText className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setPublishDialogOpen(true)}
                      disabled={isPublishing}
                      className={`inline-flex justify-center rounded-ns px-2 py-1.5 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        isPublished
                          ? "bg-ns-destructive hover:bg-ns-destructive-hover"
                          : "bg-ns-accent hover:bg-ns-accent-hover"
                      }`}
                      aria-label={
                        isPublished ? "Unpublish story" : "Publish story"
                      }
                    >
                      {isPublishing ? (
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {focusMode && (
            <div className="absolute top-3 right-3 z-40 flex items-center gap-2 rounded-ns border border-ns-border bg-ns-surface/85 px-2 py-1 shadow-ns-sm backdrop-blur opacity-40 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
              <SaveStatusIndicator
                status={saveState.status}
                lastSaved={saveState.lastSaved}
                errorMessage={saveState.errorMessage}
                isOnline={isOnline}
                className="!text-[11px] hidden md:flex"
              />
              <button
                onClick={exitFocusMode}
                aria-label="Exit focus mode"
                className="inline-flex items-center gap-1.5 rounded-ns px-2 py-1 font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">Exit focus</span>
                <kbd className="hidden sm:inline rounded border border-ns-border bg-ns-elevated px-1 font-ui text-[10px] text-ns-ink-muted">
                  Esc
                </kbd>
              </button>
            </div>
          )}

          <SlideOverPanel
            open={!isLgUp && state.leftSidebarOpen}
            onClose={closeChaptersPanel}
            side="left"
            title={isSingleDocument ? "Outline" : "Chapters"}
          >
            <SidebarPanel {...sidebarPanelProps} />
          </SlideOverPanel>

          <ConfirmDialog
            open={splitDialogOpen}
            onOpenChange={setSplitDialogOpen}
            title="Split into chapters?"
            description={splitPreview}
            confirmLabel="Split"
            isLoading={isSplitting}
            onConfirm={performSplit}
          />

          {/* ── Delete Chapter Dialog ── */}
          <ConfirmDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title="Delete Chapter"
            description="Are you sure you want to delete this chapter? This action cannot be undone."
            confirmLabel="Delete"
            variant="danger"
            onConfirm={confirmChapterDelete}
          />

          {/* ── Publish / Unpublish Dialog ── */}
          <ConfirmDialog
            open={publishDialogOpen}
            onOpenChange={setPublishDialogOpen}
            title={isPublished ? "Unpublish story?" : "Publish story?"}
            description={
              isPublished
                ? `"${state.story?.title}" will be hidden from readers and returned to draft. You can publish it again at any time.`
                : `"${state.story?.title}" will become visible to readers. You can unpublish it again at any time.`
            }
            confirmLabel={isPublished ? "Unpublish" : "Publish"}
            cancelLabel={isPublished ? "Keep published" : "Cancel"}
            isLoading={isPublishing}
            onConfirm={handlePublish}
          />

          <SaveConflictDialog
            open={
              conflictChapterId !== null &&
              conflictChapterId === state.currentChapter?.id
            }
            onOpenChange={(open) => {
              if (!open) setConflictChapterId(null);
            }}
            onKeepMine={() => void resolveConflict("mine")}
            onLoadTheirs={() => void resolveConflict("theirs")}
            resolving={resolvingConflict}
          />

          {/* ── Unsaved Changes Dialog ── */}
          <UnsavedChangesDialog
            open={unsavedChangesDialogOpen}
            onOpenChange={setUnsavedChangesDialogOpen}
            onSaveAndContinue={handleSaveAndContinue}
            onDiscardAndContinue={handleDiscardAndContinue}
            isSaving={saveState.status === "saving"}
          />

          {/* ── Chapter Summary Dialog ── */}
          {summaryResult !== null && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 animate-ns-fade-in"
              role="dialog"
              aria-modal="true"
              aria-label="Chapter summary"
              onClick={() => setSummaryResult(null)}
            >
              <div
                className="w-full max-w-lg rounded-ns-lg border border-ns-border bg-ns-elevated shadow-ns-lg"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-ns-border px-5 py-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-ns-accent" />
                    <h2 className="font-heading text-lg text-ns-ink">
                      Chapter Summary
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSummaryResult(null)}
                    aria-label="Close"
                    className="rounded-ns p-1.5 text-ns-ink-muted hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
                  {summaryResult.trim() ? (
                    <p className="font-body text-sm leading-relaxed text-ns-ink-secondary whitespace-pre-wrap">
                      {summaryResult}
                    </p>
                  ) : (
                    <p className="font-ui text-sm italic text-ns-ink-muted">
                      No summary was returned.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-ns-border px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setSummaryResult(null)}
                    className="inline-flex items-center gap-1.5 rounded-ns border border-ns-border px-3 py-1.5 font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink hover:border-ns-border-strong active:scale-[0.97] transition-all duration-150"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    disabled={!summaryResult.trim()}
                    className="inline-flex items-center gap-1.5 rounded-ns bg-ns-accent px-3 py-1.5 font-ui text-xs font-medium text-white hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChapterOpening({
  title,
  overlay = false,
}: {
  title: string;
  overlay?: boolean;
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 ${
        overlay ? "absolute inset-0 z-10 bg-ns-bg/80" : "flex-1 bg-ns-bg"
      }`}
    >
      <Loader className="w-6 h-6 text-ns-accent animate-spin" />
      <p className="font-heading italic text-lg text-ns-ink-muted">
        Opening {title || "chapter"}…
      </p>
    </div>
  );
}
