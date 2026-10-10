import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Underline from "@tiptap/extension-underline";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import { ImageNode } from "@/components/editor/ImageNode";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { loadStorageService } from "@/services/loadStorageService";
import CharacterCount from "@tiptap/extension-character-count";
import Heading from "@tiptap/extension-heading";
import {
  UndoRedo,
  Gapcursor,
  Dropcursor,
  TrailingNode,
} from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Blockquote from "@tiptap/extension-blockquote";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import Color from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { slashCommandSuggestion } from "./SlashCommandExtension";
import { CHAPTER_WORD_LIMIT } from "@/utils/chapterWordLimit";
import { docWordCount } from "@/components/editor/docWordCount";
import { SuggestionMenu } from "./SuggestionMenu";
import {
  ImageIcon,
  Loader,
  Maximize2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { EDITOR_PAGE_WIDTH } from "@/components/editor/editorZoom";
import type { ParagraphStyle } from "@novelsync/story-data-client";
import {
  FontFamilyExtension,
  FontSizeExtension,
  HighlightColorExtension,
  ParagraphStyleExtension,
  TextAlignExtension,
} from "@/components/editor/editorExtensions";
import { useAiSuggestions } from "@/hooks/useAiSuggestions";
import { useTextEnhancement } from "@/hooks/useTextEnhancement";
import {
  useImageGeneration,
  MAX_CHAPTER_IMAGES,
  countEditorImages,
} from "@/hooks/useImageGeneration";
import { ALLOWED_IMAGE_TYPES } from "@/utils/imageUpload";
import { ApiError } from "@/cloudFunctions";
import { toast } from "sonner";
import { MarkdownHeadingInputRule } from "@/components/editor/markdownHeadingInputRule";
import Code from "@tiptap/extension-code";
import { CodeBlockExtension } from "@/components/editor/CodeBlockExtension";
import {
  TaskListExtension,
  TaskItemExtension,
} from "@/components/editor/TaskListExtensions";
import {
  AssistantDiffExtension,
  assistantDiffPluginKey,
  assistantSelectionPluginKey,
} from "@/components/editor/AssistantDiffExtension";
import { useAssistantProposal } from "@/components/chat/AssistantProposalContext";

const CHARACTER_LIMIT = 50000;
const WORD_LIMIT_MESSAGE = `Chapters are limited to ${CHAPTER_WORD_LIMIT.toLocaleString()} words. Trim this one or start a new chapter to keep writing.`;
const ChapterWordCeiling = Extension.create<{ onRefused: () => void }>({
  name: "chapterWordCeiling",
  addOptions() {
    return { onRefused: () => {} };
  },
  addProseMirrorPlugins() {
    const { onRefused } = this.options;
    return [
      new Plugin({
        key: new PluginKey("chapterWordCeiling"),
        filterTransaction: (tr, state) => {
          if (!tr.docChanged) return true;
          const next = docWordCount(tr.doc);
          if (next <= CHAPTER_WORD_LIMIT) return true;
          if (next <= docWordCount(state.doc)) return true;
          onRefused();
          return false;
        },
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imagePaste: {
      /** Uploads a local image file and inserts it at the cursor. */
      uploadImageFile: (file: File) => ReturnType;
    };
  }
}

// Curly quotes, em dashes and ellipses only. The arrow, fraction, maths and
// trademark rules are off: in prose they rewrite text the writer meant.
const SmartTypography = Typography.configure({
  leftArrow: false,
  rightArrow: false,
  copyright: false,
  trademark: false,
  servicemark: false,
  registeredTrademark: false,
  oneHalf: false,
  oneQuarter: false,
  threeQuarters: false,
  plusMinus: false,
  notEqual: false,
  laquo: false,
  raquo: false,
  multiplication: false,
  superscriptTwo: false,
  superscriptThree: false,
});
const HeadingWithoutInputRules = Heading.extend({
  addInputRules() {
    return [];
  },
});

interface TipTapEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  /** Called when the editor loses focus, so the parent can flush a pending save. */
  onBlur?: () => void;
  storyId: string;
  chapterId?: string;
  userId?: string;
  onEditorReady?: (editor: Editor | null) => void;
  onTransaction?: (transaction: Transaction) => void;
  onOpenCoWrite?: () => void;
  /** Page scale in percent. */
  zoom?: number;
  paragraphStyle?: ParagraphStyle;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  initialContent,
  onSave,
  onBlur,
  storyId,
  chapterId,
  userId,
  onEditorReady,
  onTransaction,
  onOpenCoWrite,
  zoom = 100,
  paragraphStyle = "spaced",
}) => {
  const assistantProposal = useAssistantProposal();
  // Keep a ref so plugins always read the current ids without stale closure
  const uploadContextRef = useRef({ userId, storyId, chapterId });
  const editorRef = useRef<Editor | null>(null);
  // Single debounce lives in useAutosave (via onSave); the editor just forwards
  // every change through a ref to avoid a stale closure in onUpdate.
  const onSaveRef = useRef(onSave);
  const onBlurRef = useRef(onBlur);
  const onTransactionRef = useRef(onTransaction);
  // Ref so the paste plugin (created once) can surface errors via React state
  const pasteErrorRef = useRef<((msg: string) => void) | null>(null);

  uploadContextRef.current = { userId, storyId, chapterId };
  onSaveRef.current = onSave;
  onBlurRef.current = onBlur;
  onTransactionRef.current = onTransaction;

  // Timed error banner shared by all AI features and the paste plugin
  const [editorError, setEditorError] = useState("");
  const showError = useCallback((msg: string) => {
    setEditorError(msg);
    setTimeout(() => setEditorError(""), 3000);
  }, []);

  pasteErrorRef.current = showError;

  const uploadImageFileRef = useRef<(file: File, pos?: number) => void>(
    () => {},
  );
  uploadImageFileRef.current = (file, pos) => {
    const target = editorRef.current;
    if (!target) return;
    const {
      userId: uid,
      storyId: sid,
      chapterId: cid,
    } = uploadContextRef.current;
    if (!uid) return showError("Sign in to upload images.");
    // Size is not checked here: the storage service compresses large images.
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return showError("Unsupported format. Use JPEG, PNG, or WebP.");
    }
    if (countEditorImages(target) >= MAX_CHAPTER_IMAGES) {
      return showError(`Maximum ${MAX_CHAPTER_IMAGES} images per chapter.`);
    }
    const upload = loadStorageService().then((storage) =>
      storage.uploadChapterImage(file, uid, sid, cid ?? ""),
    );
    toast.promise(upload, {
      loading: "Uploading image…",
      success: "Image added",
      error: (error) =>
        error instanceof ApiError
          ? error.message
          : "Couldn't upload the image. Please try again.",
    });
    upload
      .then((src) => {
        // The writer may have opened another chapter while it uploaded.
        if (target.isDestroyed || uploadContextRef.current.chapterId !== cid) {
          return;
        }
        if (pos === undefined) {
          target.chain().focus().setImage({ src }).run();
          return;
        }
        target
          .chain()
          .focus()
          .insertContentAt(Math.min(pos, target.state.doc.content.size), {
            type: "image",
            attrs: { src },
          })
          .run();
      })
      .catch((error) => console.error("Image upload failed:", error));
  };

  // ── Feature hooks ──────────────────────────────────────────────────────────

  const {
    suggestions,
    setSuggestions,
    showSuggestionMenu,
    setShowSuggestionMenu,
    isGenerating,
    fetchNextLineSuggestions,
  } = useAiSuggestions({ storyId, chapterId });

  const { isEnhancing, handleTextEnhancement } = useTextEnhancement({
    editor: editorRef.current,
    storyId,
    chapterId,
    onError: showError,
  });

  const {
    imagePromptOpen,
    setImagePromptOpen,
    imagePrompt,
    setImagePrompt,
    isGeneratingImage,
    openImagePrompt,
    handleGenerateImage,
  } = useImageGeneration({
    editorRef,
    uploadContextRef,
    onError: showError,
  });

  // ── TipTap extensions ──────────────────────────────────────────────────────

  // Paste handler: intercepts clipboard images, uploads to Firebase Storage, inserts URL
  const ImagePasteExtension = useMemo(() => {
    return Extension.create({
      name: "imagePaste",
      addCommands() {
        return {
          uploadImageFile: (file) => () => {
            uploadImageFileRef.current(file);
            return true;
          },
        };
      },
      addProseMirrorPlugins() {
        const imageFile = (files: FileList | undefined) =>
          Array.from(files ?? []).find((file) =>
            file.type.startsWith("image/"),
          );
        return [
          new Plugin({
            key: new PluginKey("imagePaste"),
            props: {
              handlePaste(_view, event) {
                const file = imageFile(event.clipboardData?.files);
                if (!file) return false;
                event.preventDefault();
                uploadImageFileRef.current(file);
                return true;
              },
              handleDrop(view, event, _slice, moved) {
                // `moved` is a drag of existing content within the page.
                if (moved) return false;
                const file = imageFile(event.dataTransfer?.files);
                if (!file) return false;
                event.preventDefault();
                const drop = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });
                uploadImageFileRef.current(file, drop?.pos);
                return true;
              },
            },
          }),
        ];
      },
    });
  }, []);

  const SlashCommandsExtension = useMemo(() => {
    return Extension.create({
      name: "slashCommands",
      addProseMirrorPlugins() {
        const editorInstance = this.editor;
        return [
          Suggestion({
            editor: editorInstance,
            ...slashCommandSuggestion(
              async () => fetchNextLineSuggestions(editorInstance),
              openImagePrompt,
              () => onOpenCoWrite?.(),
            ),
          }),
        ];
      },
    });
  }, [fetchNextLineSuggestions, openImagePrompt, onOpenCoWrite]);

  // ── Editor instance ────────────────────────────────────────────────────────

  const editor = useEditor({
    extensions: [
      Document,
      UndoRedo,
      Gapcursor,
      Dropcursor,
      TrailingNode,
      Paragraph,
      Text,
      Bold,
      Underline,
      Italic,
      Strike,
      ImageNode,
      ImagePasteExtension,
      TextStyle,
      Color,
      FontFamilyExtension,
      FontSizeExtension,
      HighlightColorExtension,
      TextAlignExtension,
      ParagraphStyleExtension,
      SlashCommandsExtension,
      CharacterCount.configure({ limit: CHARACTER_LIMIT }),
      ChapterWordCeiling.configure({
        onRefused: () => pasteErrorRef.current?.(WORD_LIMIT_MESSAGE),
      }),
      HeadingWithoutInputRules.configure({
        levels: [1, 2, 3],
        HTMLAttributes: {
          "1": { class: "text-3xl font-bold mb-4" },
          "2": { class: "text-2xl font-semibold mb-3" },
          "3": { class: "text-xl font-semibold mb-2" },
        },
      }),
      MarkdownHeadingInputRule,
      SmartTypography,
      Placeholder.configure({
        placeholder:
          "Write something already ya silly goose… or type / for commands",
      }),
      BulletList.configure({ HTMLAttributes: { class: "list-disc" } }),
      OrderedList.configure({ HTMLAttributes: { class: "list-decimal" } }),
      Blockquote,
      HorizontalRule,
      Link.configure({ openOnClick: false }),
      ListItem,
      Code,
      CodeBlockExtension,
      TaskListExtension,
      TaskItemExtension,
      AssistantDiffExtension,
      Markdown,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      // Forward straight to the autosave hook, which owns the (single) debounce.
      onSaveRef.current(content);
    },
    onTransaction: ({ transaction }) => {
      onTransactionRef.current?.(transaction);
    },
    onFocus: ({ editor }) => {
      editor.view.dispatch(
        editor.state.tr.setMeta(assistantSelectionPluginKey, null),
      );
    },
    onBlur: ({ editor }) => {
      const { from, to } = editor.state.selection;
      editor.view.dispatch(
        editor.state.tr.setMeta(
          assistantSelectionPluginKey,
          from < to ? { from, to } : null,
        ),
      );
      // Flush a pending debounced save the moment the user clicks away.
      onBlurRef.current?.();
    },
  });

  editorRef.current = editor;

  // ── Effects ────────────────────────────────────────────────────────────────

  // Re-seed the editor only when the *chapter* changes — never on content prop
  // changes. initialContent updates after each save, and TipTap's serialized
  // getHTML() rarely matches the stored string byte-for-byte, so reacting to
  // initialContent would call setContent mid-typing and reset the caret. Keying on chapterId avoids that. The
  // `false` arg keeps the swap out of the undo history.
  const loadedChapterIdRef = useRef<string | undefined>(chapterId);
  useEffect(() => {
    if (editor && chapterId !== loadedChapterIdRef.current) {
      editor.commands.setContent(initialContent, { emitUpdate: false });
      loadedChapterIdRef.current = chapterId;
    }
  }, [editor, chapterId, initialContent]);

  useEffect(() => {
    if (onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(
        assistantDiffPluginKey,
        assistantProposal?.preview?.proposal ?? null,
      ),
    );
  }, [assistantProposal?.preview?.proposal, editor]);

  if (!editor) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-full">
      {/* AI Text Enhancement Bubble Menu */}
      <BubbleMenu
        editor={editor}
        className="bg-black text-white shadow-lg rounded-md overflow-hidden"
        shouldShow={({ from, to }) => from !== to}
      >
        <div className="flex items-center gap-1 bg-black p-1">
          <button
            onClick={() => handleTextEnhancement("expand")}
            disabled={isEnhancing}
            className="px-3 py-2 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            title="Expand text with more detail"
          >
            {isEnhancing ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
            <span>Expand</span>
          </button>

          <button
            onClick={() => handleTextEnhancement("dialogue")}
            disabled={isEnhancing}
            className="px-3 py-2 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            title="Improve dialogue quality"
          >
            {isEnhancing ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
            <span>Dialogue</span>
          </button>

          <button
            onClick={() => handleTextEnhancement("rewrite")}
            disabled={isEnhancing}
            className="px-3 py-2 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
            title="Rewrite with different phrasing"
          >
            {isEnhancing ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Rewrite</span>
          </button>
        </div>
      </BubbleMenu>

      {assistantProposal?.preview && (
        <div
          data-cy="assistant-manuscript-preview"
          role="status"
          className="shrink-0 border-y border-ns-border bg-[linear-gradient(90deg,rgba(22,163,74,0.07),var(--ns-elevated)_42%,rgba(185,28,28,0.055))] px-4 py-2.5 text-ns-ink shadow-[0_8px_24px_rgba(52,42,31,0.035)] sm:px-6"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.15em] text-ns-accent">
                Draft preview · manuscript unchanged
              </p>
              <p className="mt-0.5 truncate font-heading text-sm text-ns-ink">
                {assistantProposal.preview.proposal.summary}
              </p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                data-cy="assistant-manuscript-apply"
                disabled={!assistantProposal.preview.canApply}
                onClick={assistantProposal.preview.apply}
                className="rounded-ns bg-ns-accent px-3 py-1.5 font-ui text-[11px] font-semibold text-white shadow-ns-sm transition-colors hover:bg-ns-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {assistantProposal.preview.busy ? "Applying…" : "Apply & save"}
              </button>
              <button
                type="button"
                onClick={assistantProposal.preview.reject}
                disabled={assistantProposal.preview.busy}
                className="rounded-ns border border-ns-border-strong bg-ns-elevated px-2.5 py-1.5 font-ui text-[11px] font-semibold text-ns-ink-secondary transition-colors hover:bg-ns-surface-hover disabled:opacity-40"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={assistantProposal.preview.askForRevision}
                disabled={assistantProposal.preview.busy}
                className="hidden rounded-ns px-2 py-1.5 font-ui text-[11px] text-ns-accent transition-colors hover:bg-ns-accent-subtle disabled:opacity-40 sm:block"
              >
                Ask for a change
              </button>
            </div>
          </div>
          <p className="mx-auto mt-1.5 hidden w-full max-w-4xl font-ui text-[10px] text-ns-ink-muted sm:block">
            <span className="text-emerald-700 dark:text-emerald-300">
              Green is new
            </span>
            {" · "}
            <span className="text-red-700 line-through dark:text-red-300">
              red is removed
            </span>
            {" · Nothing changes until you apply."}
          </p>
        </div>
      )}

      <div className="w-full flex-1 bg-ns-elevated text-ns-ink transition-colors">
        <div
          className="mx-auto w-full px-4 py-10 sm:px-10 lg:px-16"
          data-paragraph-style={paragraphStyle}
          style={{ maxWidth: EDITOR_PAGE_WIDTH, zoom: zoom / 100 }}
        >
          <EditorContent
            onClick={() => editor.commands.focus()}
            className="w-full focus:outline-none max-w-none"
            editor={editor}
            data-cy="chapter-editor"
          />
        </div>
      </div>

      {/* Loading indicator for next-line suggestions */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ns-elevated border border-ns-border rounded-lg p-6 shadow-xl transition-colors w-72">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ns-accent"></div>
              <span className="text-ns-ink">Generating…</span>
            </div>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ns-surface">
              <div
                className="h-full rounded-full bg-ns-accent transition-all duration-500 ease-out"
                style={{ width: "35%" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Suggestion Menu */}
      {showSuggestionMenu && suggestions.length > 0 && (
        <SuggestionMenu
          suggestions={suggestions}
          editor={editor}
          onClose={() => {
            setShowSuggestionMenu(false);
            setSuggestions([]);
          }}
        />
      )}

      {/* Error Toast */}
      {editorError && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-md">
          <p className="text-sm">{editorError}</p>
        </div>
      )}

      {/* Image Generation Modal */}
      {imagePromptOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setImagePromptOpen(false);
          }}
        >
          <div className="bg-ns-elevated border border-ns-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-ns-accent" />
              <h2 className="font-heading text-lg text-ns-ink">
                Generate Image
              </h2>
            </div>
            <p className="font-ui text-sm text-ns-ink-secondary">
              Describe the image you want to create.
            </p>
            <textarea
              autoFocus
              className="w-full bg-ns-surface border border-ns-border rounded-ns px-3 py-2 text-ns-ink font-ui text-sm placeholder:text-ns-ink-muted resize-none focus:outline-none focus:border-ns-accent transition-colors"
              rows={3}
              placeholder="A misty forest at dawn with golden light filtering through ancient oaks…"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  void handleGenerateImage();
                if (e.key === "Escape") setImagePromptOpen(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setImagePromptOpen(false)}
                className="px-4 py-2 font-ui text-sm text-ns-ink-secondary hover:text-ns-ink hover:bg-ns-surface-hover rounded-ns transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleGenerateImage()}
                disabled={isGeneratingImage || !imagePrompt.trim()}
                className="px-4 py-2 font-ui text-sm bg-ns-accent text-white rounded-ns hover:bg-ns-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGeneratingImage ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isGeneratingImage ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
