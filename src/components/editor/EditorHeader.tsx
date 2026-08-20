import { useCallback, useState } from "react";
import * as Icons from "../common/Icons";
import { Editor } from "@tiptap/react";
import { LinkModal } from "./LinkModal";
import api from "@/cloudFunctions";
import { List, ZoomIn, ZoomOut } from "lucide-react";

interface EditorHeaderProps {
  editor: Editor;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
  storyId?: string;
}

const ZOOM_PRESETS = [50, 75, 90, 100, 125, 150, 200];

const EditorHeader: React.FC<EditorHeaderProps> = ({
  editor,
  zoomLevel = 100,
  onZoomChange,
  storyId: _storyId,
}) => {
  const [modalIsOpen, setIsOpen] = useState(false);
  const [genImage, setGenImage] = useState("");
  const [_isLoading, setIsLoading] = useState(false);

  const handleZoomIn = useCallback(() => {
    if (!onZoomChange) return;
    const currentIndex = ZOOM_PRESETS.findIndex((z) => z >= zoomLevel);
    const nextIndex =
      currentIndex < ZOOM_PRESETS.length - 1 ? currentIndex + 1 : currentIndex;
    onZoomChange(ZOOM_PRESETS[nextIndex]);
  }, [zoomLevel, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    if (!onZoomChange) return;
    const currentIndex = ZOOM_PRESETS.findIndex((z) => z >= zoomLevel);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    onZoomChange(ZOOM_PRESETS[prevIndex]);
  }, [zoomLevel, onZoomChange]);

  const handleZoomSelect = useCallback(
    (value: string) => {
      if (!onZoomChange) return;
      onZoomChange(parseInt(value, 10));
    },
    [onZoomChange],
  );

  const generateImage = async (prompt: string) => {
    setIsLoading(true);
    try {
      const response = await api.post<{ image: string }>("/generate", {
        prompt,
      });
      const imageData = response.data.image;
      editor
        .chain()
        .focus()
        .setImage({ src: `data:image/png;base64,${imageData}` })
        .run();
    } catch (error) {
      console.error("Error generating text:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBold = useCallback(() => {
    editor.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleUnderline = useCallback(() => {
    editor.chain().focus().toggleUnderline().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor.chain().focus().toggleItalic().run();
  }, [editor]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setGenImage("");
  }, []);

  const saveLink = useCallback(async () => {
    if (genImage) {
      await generateImage(genImage);
    }
    editor.commands.blur();
    closeModal();
  }, [editor, genImage, closeModal]);

  const toolbarBtn = (active: boolean) =>
    `p-2 rounded-ns transition-all duration-150 ${
      active
        ? "bg-ns-accent-subtle text-ns-accent"
        : "text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink"
    }`;

  const disabledBtn =
    "p-2 rounded-ns text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 justify-center">
      {/* Undo */}
      <button
        className={disabledBtn}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Icons.RotateLeft />
      </button>
      {/* Redo */}
      <button
        className={disabledBtn}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Icons.RotateRight />
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-ns-border mx-1 self-center" />

      {/* Bold */}
      <button
        className={toolbarBtn(editor.isActive("bold"))}
        onClick={toggleBold}
        title="Bold"
      >
        <Icons.Bold />
      </button>
      {/* Italic */}
      <button
        className={toolbarBtn(editor.isActive("italic"))}
        onClick={toggleItalic}
        title="Italic"
      >
        <Icons.Italic />
      </button>
      {/* Underline */}
      <button
        className={toolbarBtn(editor.isActive("underline"))}
        onClick={toggleUnderline}
        title="Underline"
      >
        <Icons.Underline />
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-ns-border mx-1 self-center" />

      {/* H1 */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`${toolbarBtn(editor.isActive("heading", { level: 1 }))} font-ui text-xs font-semibold px-2`}
        title="Heading 1"
      >
        H1
      </button>
      {/* H2 */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`${toolbarBtn(editor.isActive("heading", { level: 2 }))} font-ui text-xs font-semibold px-2`}
        title="Heading 2"
      >
        H2
      </button>
      {/* Bullet List */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={toolbarBtn(editor.isActive("bulletList"))}
        title="Bullet list"
      >
        <List className="w-4 h-4" />
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-ns-border mx-1 self-center" />

      {/* Word Count */}
      <div className="px-2 font-ui text-xs text-ns-ink-muted tabular-nums select-none">
        {editor.storage.characterCount.words()} words
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-ns-border mx-1 self-center" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-0.5">
        <button
          className={disabledBtn}
          onClick={handleZoomOut}
          disabled={zoomLevel <= ZOOM_PRESETS[0]}
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <select
          value={zoomLevel}
          onChange={(e) => handleZoomSelect(e.target.value)}
          className="h-8 px-1.5 rounded-ns bg-transparent border border-ns-border text-ns-ink-secondary font-ui text-xs hover:bg-ns-surface-hover transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-ns-accent"
        >
          {ZOOM_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {preset}%
            </option>
          ))}
        </select>

        <button
          className={disabledBtn}
          onClick={handleZoomIn}
          disabled={zoomLevel >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1]}
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      <LinkModal
        url={genImage}
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Enter Prompt Modal"
        closeModal={closeModal}
        onChangeUrl={(e) => setGenImage(e.target.value)}
        onSaveLink={saveLink}
      />
    </div>
  );
};

export default EditorHeader;
