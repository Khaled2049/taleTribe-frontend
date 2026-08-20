import "../style.css";
import { useCallback, useEffect, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BookPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  Heading1,
  Heading2,
  IndentDecrease,
  IndentIncrease,
  Link2,
  List,
  ListOrdered,
  Loader,
  PenLine,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Save,
  ScrollText,
  Sparkles,
  Undo2,
  Upload,
  X,
} from "lucide-react";

import { useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../contexts/AuthContext";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import { Chapter, Story } from "@novelsync/story-data-client";

// Import components
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import {
  ConfirmDialog,
  SlideOverPanel,
  UnsavedChangesDialog,
} from "@/components/common";
import { Editor } from "@tiptap/react";

// Import hooks
import { useEditorState } from "@/hooks/useEditorState";
import { useAutosave } from "@/hooks/useAutosave";
import { SaveStatusIndicator } from "@/components/editor/SaveStatusIndicator";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { InteractiveStoryPanel } from "@/components/editor/InteractiveStoryPanel";
import { FloatingChatButton } from "../chat/FloatingChatButton";
import { useCoWrite } from "@/hooks/useCoWrite";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { toast } from "sonner";
import { summarizeChapter } from "@/cloudFunctions/ai";

const DEMO_STORY: Story = {
  id: "demo",
  title: "My Story",
  description: "",
  userId: "",
  isPublished: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  chapterCount: 1,
  author: "You",
  views: 0,
  likes: 0,
};

const DEMO_CHAPTER: Chapter = {
  id: "demo-chapter",
  title: "Chapter 1",
  content: "<p>Start writing your story here…</p>",
  order: 0,
  wordCount: 0,
  userId: "",
};

export function SimpleEditor() {
  const { isDemo, requireAuth } = useDemoMode();
  const { storyId } = useParams<{ storyId: string }>();
  const [searchParams] = useSearchParams();
  const openInteractivePanelOnMount = searchParams.get("wizard") === "true";
  const { user } = useAuthContext();

  // Use the new consolidated state hook
  const { state, actions } = useEditorState();
  const { isLgUp } = useBreakpoint();
  const [isPublishing, setIsPublishing] = useState(false);

  // Network status
  const { isOnline } = useNetworkStatus();

  // Editor instance for header
  const [editor, setEditor] = useState<Editor | null>(null);
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
  const [pendingChapter, setPendingChapter] = useState<Chapter | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState("16px");
  const [fontColor, setFontColor] = useState("#1f2937");
  const [highlightColor, setHighlightColor] = useState("#fef3c7");
  const [lineHeight, setLineHeight] = useState("1.8");
  const [paragraphSpacing, setParagraphSpacing] = useState("0");

  const fontFamilies = [
    "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    "Georgia, serif",
    "'Times New Roman', serif",
    "'Courier New', monospace",
  ];
  const fontSizes = ["12px", "14px", "16px", "18px", "20px", "24px", "28px"];
  const lineHeights = ["1.2", "1.4", "1.6", "1.8", "2"];
  const paragraphSpacings = ["0", "0.5rem", "0.75rem", "1rem", "1.25rem"];

  useEffect(() => {
    if (isLgUp) {
      return;
    }
    actions.setLeftSidebarOpen(false);
    actions.setRightSidebarOpen(false);
  }, [isLgUp, actions]);

  // Save function that will be passed to useAutosave
  const performSave = useCallback(
    async (content: string) => {
      if (isDemo) return;
      if (!state.story) {
        throw new Error("No story selected");
      }

      // Save chapter
      if (state.currentChapter) {
        const savedChapter = await storyWorkspaceRepo.updateChapter(
          state.story,
          state.currentChapter,
          state.chapterTitle,
          content,
        );

        // Update chapter in list with new content and word count. `content`
        // MUST be included — otherwise the in-memory chapters cache keeps the
        // old text and switching back to this chapter shows stale content
        // (Firestore is correct, only the cache is stale).
      actions.updateChapterInList(state.currentChapter.id, {
          ...savedChapter,
        });
      }

      // Only update story metadata if it changed (optimization)
      if (state.metadataChanged) {
        const savedStory = await storyWorkspaceRepo.updateStory({
          ...state.story,
          title: state.storyTitle,
          description: state.storyDescription,
        });
        actions.replaceStory(savedStory);
        actions.clearMetadataChanged();
      }
    },
    [
      state.story,
      state.currentChapter,
      state.chapterTitle,
      state.storyTitle,
      state.storyDescription,
      state.metadataChanged,
      actions,
    ],
  );

  // Initialize autosave hook
  const {
    triggerSave,
    forceSave,
    flushSave,
    saveState,
    isDirty,
    resetSaveState,
  } = useAutosave({
    onSave: performSave,
    debounceMs: 3000,
    enabled: !!state.story && !!state.currentChapter,
  });

  // Load story and chapters
  const loadStory = useCallback(
    async (loadStoryId: string) => {
      actions.setLoading(true);
      resetSaveState();

      const story = await storyWorkspaceRepo.getStory(loadStoryId);
      if (story) {
        const storyChapters = await storyWorkspaceRepo.getChapters(story);
        const firstChapter = storyChapters.length > 0 ? storyChapters[0] : null;
        actions.loadStory(story, storyChapters, firstChapter, {
          leftSidebarOpen: isLgUp,
        });
      }
    },
    [actions, isLgUp, resetSaveState],
  );

  // Load story on component mount
  useEffect(() => {
    if (isDemo) {
      actions.loadStory(DEMO_STORY, [DEMO_CHAPTER], DEMO_CHAPTER, {
        leftSidebarOpen: isLgUp,
      });
      return;
    }
    if (storyId) {
      loadStory(storyId);
    }
  }, [storyId, user, loadStory, isDemo, actions]);

  // Handle new chapter creation
  const handleNewChapter = async () => {
    if (!requireAuth()) return;
    if (!state.story) return;

    // Save current content first if dirty
    if (isDirty && state.currentChapter?.content) {
      await forceSave();
    }

    try {
      const newChapter = await storyWorkspaceRepo.createChapter(
        state.story,
        "New Chapter",
        state.chapters.length,
      );
      actions.addChapter(newChapter);
      resetSaveState();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add chapter.",
      );
    }
  };

  // Summarize the current chapter and persist the summary.
  const handleSummarizeChapter = async () => {
    if (!requireAuth()) return;
    if (!state.story || !state.currentChapter) return;

    // Save any pending edits first so PostgreSQL has the latest chapter text.
    if (isDirty && state.currentChapter?.content) {
      await forceSave();
    }

    setIsSummarizing(true);
    try {
      const result = await summarizeChapter({ storyId: state.story.id, chapterId: state.currentChapter.id });
      setSummaryResult(result.summary);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to summarize chapter.");
    } finally { setIsSummarizing(false); }
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
    if (!requireAuth()) return;
    if (!state.story) return;

    // Save before publishing if dirty
    if (isDirty && state.currentChapter?.content) {
      await forceSave();
    }

    const wasPublished = state.story.isPublished;

    try {
      setIsPublishing(true);
      const savedStory = await storyWorkspaceRepo.updateStory({ ...state.story, isPublished: !wasPublished });
      actions.replaceStory(savedStory);

      if (!wasPublished) {
        toast.success("Story marked published. Public discovery will be available after its migration.");
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
  const handleChapterSelect = (chapter: Chapter) => {
    if (isDirty) {
      setPendingChapter(chapter);
      setUnsavedChangesDialogOpen(true);
    } else {
      actions.selectChapter(chapter);
      if (!isLgUp) {
        actions.setLeftSidebarOpen(false);
      }
      resetSaveState();
    }
  };

  // Handle save and continue for unsaved changes dialog
  const handleSaveAndContinue = async () => {
    if (state.currentChapter?.content) {
      await forceSave();
    }
    if (pendingChapter) {
      actions.selectChapter(pendingChapter);
      if (!isLgUp) {
        actions.setLeftSidebarOpen(false);
      }
      resetSaveState();
    }
    setPendingChapter(null);
  };

  // Handle discard and continue
  const handleDiscardAndContinue = () => {
    if (pendingChapter) {
      actions.selectChapter(pendingChapter);
      if (!isLgUp) {
        actions.setLeftSidebarOpen(false);
      }
      resetSaveState();
    }
    setPendingChapter(null);
  };

  // Handle metadata changes - trigger save
  const handleMetadataChange = () => {
    if (state.currentChapter && state.currentChapter.content) {
      triggerSave(state.currentChapter.content);
    }
  };

  // Handle content changes in editor
  const handleContentChange = (content: string) => {
    actions.updateChapterContent(content);
  };

  // Handle save from editor (autosave trigger)
  const handleEditorSave = (content: string) => {
    triggerSave(content);
  };

  // Handle chapter delete request
  const handleChapterDeleteRequest = (chapterId: string) => {
    setChapterToDelete(chapterId);
    setDeleteDialogOpen(true);
  };

  // Confirm chapter deletion
  const confirmChapterDelete = async () => {
    if (isDemo || !state.story || !chapterToDelete) return;

    try {
      const chapter = state.chapters.find((item) => item.id === chapterToDelete);
      if (!chapter) throw new Error("Chapter not found");
      await storyWorkspaceRepo.deleteChapter(state.story, chapter);
      actions.deleteChapter(chapterToDelete);
      resetSaveState();
    } catch (error) {
      console.error("Error deleting chapter:", error);
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

  const activeTextAlign = editor?.isActive({ textAlign: "center" })
    ? "center"
    : editor?.isActive({ textAlign: "right" })
      ? "right"
      : editor?.isActive({ textAlign: "justify" })
        ? "justify"
        : "left";

  const openChaptersPanel = () => {
    if (!isLgUp) {
      actions.setRightSidebarOpen(false);
    }
    actions.setLeftSidebarOpen(true);
  };

  const openInspectorPanel = () => {
    if (!isLgUp) {
      actions.setLeftSidebarOpen(false);
    }
    actions.setRightSidebarOpen(true);
  };

  const closeChaptersPanel = () => {
    actions.setLeftSidebarOpen(false);
  };

  const closeInspectorPanel = () => {
    actions.setRightSidebarOpen(false);
  };

  const inspectorPanelContent = (
    <>
      <div className="flex border-b border-ns-border flex-shrink-0">
        <button
          onClick={() => actions.setRightTab("format")}
          className={`flex-1 py-2.5 font-ui text-xs font-medium tracking-wide transition-all duration-150 ${
            state.rightTab === "format"
              ? "border-b-2 border-ns-accent text-ns-accent"
              : "text-ns-ink-muted hover:text-ns-ink-secondary hover:bg-ns-surface-hover"
          }`}
        >
          Format
        </button>
        <button
          onClick={() => actions.setRightTab("document")}
          className={`flex-1 py-2.5 font-ui text-xs font-medium tracking-wide transition-all duration-150 ${
            state.rightTab === "document"
              ? "border-b-2 border-ns-accent text-ns-accent"
              : "text-ns-ink-muted hover:text-ns-ink-secondary hover:bg-ns-surface-hover"
          }`}
        >
          Document
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {state.rightTab === "format" && editor && (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] tracking-[0.09em] uppercase text-ns-ink-muted font-ui mb-2">
                Text
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={fontSize}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFontSize(value);
                    editor.chain().focus().setFontSize(value).run();
                  }}
                  className="rounded-ns border border-ns-border bg-white px-2 py-1.5 text-xs font-ui"
                >
                  {fontSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <select
                  defaultValue={fontFamilies[0]}
                  onChange={(event) => {
                    editor
                      .chain()
                      .focus()
                      .setFontFamily(event.target.value)
                      .run();
                  }}
                  className="rounded-ns border border-ns-border bg-white px-2 py-1.5 text-xs font-ui"
                >
                  {fontFamilies.map((family) => (
                    <option key={family} value={family}>
                      {family.includes("Helvetica Neue")
                        ? "Helvetica Neue"
                        : family.split(",")[0].replace(/'/g, "")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => editor.chain().focus().undo().run()}
                  className="p-2 rounded-ns border border-ns-border hover:bg-white"
                  title="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().redo().run()}
                  className="p-2 rounded-ns border border-ns-border hover:bg-white"
                  title="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().setHorizontalRule().run()
                  }
                  className="p-2 rounded-ns border border-ns-border hover:bg-white"
                  title="Divider"
                >
                  <RemoveFormatting className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().clearTextFormatting().run()
                  }
                  className="p-2 rounded-ns border border-ns-border hover:bg-white"
                  title="Clear formatting"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`px-2 py-1.5 rounded-ns border text-xs font-semibold ${editor.isActive("bold") ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Bold"
                >
                  B
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`px-2 py-1.5 rounded-ns border text-xs italic ${editor.isActive("italic") ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Italic"
                >
                  I
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  className={`px-2 py-1.5 rounded-ns border text-xs underline ${editor.isActive("underline") ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Underline"
                >
                  U
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  className={`px-2 py-1.5 rounded-ns border text-xs line-through ${editor.isActive("strike") ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Strikethrough"
                >
                  S
                </button>
                <button
                  onClick={applyLink}
                  className={`p-2 rounded-ns border ${editor.isActive("link") ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Link"
                >
                  <Link2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] tracking-[0.09em] uppercase text-ns-ink-muted font-ui mb-2">
                Structure
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => editor.chain().focus().setParagraph().run()}
                  className={`p-2 rounded-ns border ${editor.isActive("paragraph") ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Paragraph"
                >
                  <Pilcrow className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                  }
                  className={`p-2 rounded-ns border ${editor.isActive("heading", { level: 1 }) ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Heading 1"
                >
                  <Heading1 className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                  className={`p-2 rounded-ns border ${editor.isActive("heading", { level: 2 }) ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Heading 2"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                  className={`p-2 rounded-ns border ${editor.isActive("bulletList") ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Bullet list"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                  className={`p-2 rounded-ns border ${editor.isActive("orderedList") ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Numbered list"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().toggleBlockquote().run()
                  }
                  className={`p-2 rounded-ns border ${editor.isActive("blockquote") ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Quote"
                >
                  <Quote className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] tracking-[0.09em] uppercase text-ns-ink-muted font-ui mb-2">
                Paragraph
              </p>
              <div className="flex items-center gap-1 flex-wrap mb-2">
                <button
                  onClick={() =>
                    editor.chain().focus().setTextAlign("left").run()
                  }
                  className={`p-2 rounded-ns border ${activeTextAlign === "left" ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Align left"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().setTextAlign("center").run()
                  }
                  className={`p-2 rounded-ns border ${activeTextAlign === "center" ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Align center"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().setTextAlign("right").run()
                  }
                  className={`p-2 rounded-ns border ${activeTextAlign === "right" ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Align right"
                >
                  <AlignRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    editor.chain().focus().setTextAlign("justify").run()
                  }
                  className={`p-2 rounded-ns border ${activeTextAlign === "justify" ? "bg-ns-accent-subtle border-ns-accent" : "border-ns-border hover:bg-white"}`}
                  title="Justify"
                >
                  <AlignJustify className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().decreaseIndent().run()}
                  className="p-2 rounded-ns border border-ns-border hover:bg-white"
                  title="Outdent"
                >
                  <IndentDecrease className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().increaseIndent().run()}
                  className="p-2 rounded-ns border border-ns-border hover:bg-white"
                  title="Indent"
                >
                  <IndentIncrease className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={lineHeight}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLineHeight(value);
                    editor.chain().focus().setLineHeight(value).run();
                  }}
                  className="rounded-ns border border-ns-border bg-white px-2 py-1.5 text-xs font-ui"
                >
                  {lineHeights.map((value) => (
                    <option key={value} value={value}>
                      Line {value}
                    </option>
                  ))}
                </select>
                <select
                  value={paragraphSpacing}
                  onChange={(event) => {
                    const value = event.target.value;
                    setParagraphSpacing(value);
                    editor.chain().focus().setParagraphSpacing(value).run();
                  }}
                  className="rounded-ns border border-ns-border bg-white px-2 py-1.5 text-xs font-ui"
                >
                  {paragraphSpacings.map((value) => (
                    <option key={value} value={value}>
                      Space {value === "0" ? "none" : value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="text-[10px] tracking-[0.09em] uppercase text-ns-ink-muted font-ui mb-2">
                Colors
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-ns border border-ns-border bg-white px-2 py-1.5 text-xs font-ui flex items-center justify-between gap-2">
                  Text
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFontColor(value);
                      editor.chain().focus().setColor(value).run();
                    }}
                    className="h-6 w-8 cursor-pointer border-0 bg-transparent"
                  />
                </label>
                <label className="rounded-ns border border-ns-border bg-white px-2 py-1.5 text-xs font-ui flex items-center justify-between gap-2">
                  Highlight
                  <input
                    type="color"
                    value={highlightColor}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHighlightColor(value);
                      editor.chain().focus().setHighlightColor(value).run();
                    }}
                    className="h-6 w-8 cursor-pointer border-0 bg-transparent"
                  />
                </label>
              </div>
              <button
                onClick={() =>
                  editor.chain().focus().unsetHighlightColor().run()
                }
                className="mt-2 w-full rounded-ns border border-ns-border bg-white px-2 py-1.5 text-xs font-ui hover:bg-ns-surface-hover"
              >
                Clear highlight
              </button>
            </div>
          </div>
        )}

        {state.rightTab === "document" && (
          <div className="space-y-4">
            <div className="rounded-ns border border-ns-border bg-white p-3 space-y-1.5">
              <p className="text-[10px] tracking-[0.09em] uppercase text-ns-ink-muted font-ui mb-1">
                Details
              </p>
              <p className="text-xs font-ui text-ns-ink-secondary">
                Words:{" "}
                <span className="text-ns-ink">
                  {editor?.storage.characterCount?.words?.() || 0}
                </span>
              </p>
              <p className="text-xs font-ui text-ns-ink-secondary">
                Characters:{" "}
                <span className="text-ns-ink">
                  {editor?.storage.characterCount?.characters?.() || 0}
                </span>
              </p>
              <p className="text-xs font-ui text-ns-ink-secondary">
                Chapters:{" "}
                <span className="text-ns-ink">{state.chapters.length}</span>
              </p>
            </div>
            <div className="rounded-ns border border-ns-border bg-white p-3">
              <p className="text-[10px] tracking-[0.09em] uppercase text-ns-ink-muted font-ui mb-2">
                Defaults
              </p>
              <button
                onClick={() => {
                  if (!editor) return;
                  setFontSize("16px");
                  setLineHeight("1.8");
                  setParagraphSpacing("0");
                  setFontColor("#1f2937");
                  setHighlightColor("#fef3c7");
                  editor
                    .chain()
                    .focus()
                    .setFontFamily(fontFamilies[0])
                    .setFontSize("16px")
                    .setColor("#1f2937")
                    .unsetHighlightColor()
                    .setLineHeight("1.8")
                    .setParagraphSpacing("0")
                    .unsetTextAlign()
                    .run();
                }}
                className="w-full rounded-ns border border-ns-border bg-white px-2 py-1.5 text-xs font-ui hover:bg-ns-surface-hover"
              >
                Reset document style
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  const isPublished = !!state.story?.isPublished;

  return (
    <div className="relative w-full h-full bg-ns-bg flex overflow-hidden">
      {state.isLoading ? (
        /* ── Loading State ── */
        <div className="flex flex-col items-center justify-center w-full h-full gap-4 animate-ns-fade-in">
          <Loader className="w-8 h-8 text-ns-accent animate-spin" />
          <p className="font-heading italic text-lg text-ns-ink-muted">
            Opening your story…
          </p>
        </div>
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
              <SidebarPanel
                chapters={state.chapters}
                currentChapterId={state.currentChapter?.id || ""}
                chapterTitle={state.chapterTitle}
                storyTitle={state.storyTitle}
                onChapterSelect={handleChapterSelect}
                onChapterDelete={handleChapterDeleteRequest}
                onChapterAdd={handleNewChapter}
                onStoryTitleChange={actions.updateStoryTitle}
                onChapterTitleChange={actions.updateChapterTitle}
                onMetadataChange={handleMetadataChange}
                activeTab={state.activeTab}
                onTabChange={actions.setActiveTab}
              />
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
            className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-20 bg-ns-elevated border border-ns-border rounded-r-ns py-4 w-5 items-center justify-center shadow-ns-sm hover:bg-ns-surface-hover hover:shadow-ns transition-all duration-200 group"
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
            <div className="lg:hidden flex items-center justify-between border-b border-ns-border bg-ns-surface px-3 py-2 gap-2">
              <p className="font-ui text-xs text-ns-ink-secondary truncate">
                {state.currentChapter?.title || "No chapter selected"}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={openChaptersPanel}
                  className="inline-flex items-center gap-1 rounded-ns border border-ns-border px-2 py-1 text-[11px] font-ui text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
                >
                  <BookPlus className="h-3.5 w-3.5" />
                  Chapters
                </button>
                <button
                  type="button"
                  onClick={openInspectorPanel}
                  className="inline-flex items-center gap-1 rounded-ns border border-ns-border px-2 py-1 text-[11px] font-ui text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                  Format
                </button>
              </div>
            </div>

            {/* Writing Canvas */}
            {state.currentChapter ? (
              <div className="flex-1 overflow-y-auto bg-ns-bg">
                <div className="mx-auto min-h-full flex flex-col">
                  <TipTapEditor
                    initialContent={state.currentChapter.content}
                    onContentChange={handleContentChange}
                    onSave={handleEditorSave}
                    onBlur={flushSave}
                    storyId={state.story?.id || ""}
                    chapterId={state.currentChapter?.id || ""}
                    userId={user?.uid}
                    onEditorReady={setEditor}
                    onOpenCoWrite={openCoWrite}
                  />
                </div>
              </div>
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

            {/* ── Status Bar ── */}
            {state.currentChapter && (
              <div className="flex-shrink-0 border-t border-ns-border bg-ns-surface">
                {isInteractivePanelOpen && editor && (
                  <div className="border-b border-ns-border bg-transparent px-3 py-3 sm:px-4 sm:py-4">
                    <div className="mx-auto w-full max-w-4xl">
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
                          triggerSave(editor.getHTML());
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="hidden sm:flex items-center gap-3 px-4 py-2">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        if (requireAuth()) openCoWrite();
                      }}
                      title="Co-Write with AI"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink hover:border-ns-border-strong active:scale-[0.97] transition-all duration-150 whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="hidden lg:inline">Co-Write</span>
                      <span className="lg:hidden">AI</span>
                    </button>
                    <button
                      onClick={handleNewChapter}
                      title="New chapter"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink hover:border-ns-border-strong active:scale-[0.97] transition-all duration-150 whitespace-nowrap"
                    >
                      <BookPlus className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="hidden lg:inline">New Chapter</span>
                      <span className="lg:hidden">New</span>
                    </button>
                    <button
                      onClick={() => {
                        if (state.currentChapter?.content) {
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

                  <div className="flex-1 flex items-center justify-center min-w-0">
                    <SaveStatusIndicator
                      status={saveState.status}
                      lastSaved={saveState.lastSaved}
                      errorMessage={saveState.errorMessage}
                      isOnline={isOnline}
                    />
                  </div>

                  <div className="flex items-center justify-end flex-shrink-0">
                    <button
                      onClick={() => setPublishDialogOpen(true)}
                      disabled={isPublishing || isDemo}
                      title={
                        isDemo ? "Sign in to publish your story" : undefined
                      }
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

                <div className="sm:hidden border-t border-ns-border px-3 py-2 space-y-2">
                  <div className="flex items-center justify-center">
                    <SaveStatusIndicator
                      status={saveState.status}
                      lastSaved={saveState.lastSaved}
                      errorMessage={saveState.errorMessage}
                      isOnline={isOnline}
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => {
                        if (requireAuth()) openCoWrite();
                      }}
                      className="inline-flex justify-center rounded-ns border border-ns-border px-2 py-1.5 text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
                      aria-label="Open Co-Write"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleNewChapter}
                      className="inline-flex justify-center rounded-ns border border-ns-border px-2 py-1.5 text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
                      aria-label="Create new chapter"
                    >
                      <BookPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (state.currentChapter?.content) {
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
                      disabled={isPublishing || isDemo}
                      title={
                        isDemo ? "Sign in to publish your story" : undefined
                      }
                      className={`inline-flex justify-center rounded-ns px-2 py-1.5 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        isPublished
                          ? "bg-ns-destructive hover:bg-ns-destructive-hover"
                          : "bg-ns-accent hover:bg-ns-accent-hover"
                      }`}
                      aria-label={isPublished ? "Unpublish story" : "Publish story"}
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

          {/* ── Right Sidebar Toggle ── */}
          <button
            onClick={actions.toggleRightSidebar}
            aria-label={
              state.rightSidebarOpen
                ? "Collapse inspector panel"
                : "Expand inspector panel"
            }
            className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-20 bg-ns-elevated border border-ns-border rounded-l-ns py-4 w-5 items-center justify-center shadow-ns-sm hover:bg-ns-surface-hover hover:shadow-ns transition-all duration-200 group"
            style={{ right: state.rightSidebarOpen ? "320px" : "0px" }}
          >
            {state.rightSidebarOpen ? (
              <ChevronRight className="w-3 h-3 text-ns-ink-muted group-hover:text-ns-ink transition-colors" />
            ) : (
              <ChevronLeft className="w-3 h-3 text-ns-ink-muted group-hover:text-ns-ink transition-colors" />
            )}
          </button>

          {/* ── Right Sidebar ── */}
          <div
            className={`hidden lg:block relative bg-ns-surface border-l border-ns-border transition-all duration-300 overflow-hidden flex-shrink-0 ${
              state.rightSidebarOpen ? "w-80" : "w-0"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <button
              type="button"
              onClick={actions.toggleRightSidebar}
              aria-label="Close format and document panel"
              className="absolute top-2 right-2 z-30 rounded-ns p-1.5 text-ns-ink-muted hover:bg-ns-surface-hover hover:text-ns-ink transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-80 h-full flex flex-col overflow-hidden">
              {inspectorPanelContent}
            </div>
          </div>

          <SlideOverPanel
            open={!isLgUp && state.leftSidebarOpen}
            onClose={closeChaptersPanel}
            side="left"
            title="Chapters"
          >
            <SidebarPanel
              chapters={state.chapters}
              currentChapterId={state.currentChapter?.id || ""}
              chapterTitle={state.chapterTitle}
              storyTitle={state.storyTitle}
              onChapterSelect={handleChapterSelect}
              onChapterDelete={handleChapterDeleteRequest}
              onStoryTitleChange={actions.updateStoryTitle}
              onChapterTitleChange={actions.updateChapterTitle}
              onMetadataChange={handleMetadataChange}
              activeTab={state.activeTab}
              onTabChange={actions.setActiveTab}
            />
          </SlideOverPanel>

          <SlideOverPanel
            open={!isLgUp && state.rightSidebarOpen}
            onClose={closeInspectorPanel}
            side="right"
            title="Format & Document"
          >
            <div className="h-full flex flex-col overflow-hidden">
              {inspectorPanelContent}
            </div>
          </SlideOverPanel>

          {!isDemo && <FloatingChatButton storyId={state.story?.id} />}

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
