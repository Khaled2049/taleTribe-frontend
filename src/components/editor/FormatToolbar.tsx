import { useRef, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  ChevronDown,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Link2,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo2,
  RemoveFormatting,
  SeparatorHorizontal,
  UnfoldVertical,
  Undo2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFormatState } from "@/components/editor/useLiveEditorState";
import { EDITOR_FONTS, findEditorFont } from "@/components/editor/editorFonts";
import { ZOOM_LEVELS, type EditorZoom } from "@/components/editor/editorZoom";
import type { ParagraphStyle } from "@novelsync/story-data-client";

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 36, 48];
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 96;
const LINE_HEIGHTS = ["1.2", "1.4", "1.6", "1.8", "2"];
const DEFAULT_LINE_HEIGHT = "1.8";
const PARAGRAPH_SPACINGS = [
  { label: "None", value: "0" },
  { label: "Small", value: "0.5rem" },
  { label: "Medium", value: "0.75rem" },
  { label: "Large", value: "1rem" },
  { label: "Extra large", value: "1.25rem" },
];
const DEFAULT_PARAGRAPH_SPACING = "0";

// Manuscript colours, not interface colours. Mid-tones only, so text stays
// readable whichever theme the chapter is opened in.
const TEXT_COLORS = [
  "#6b7280",
  "#dc2626",
  "#ea580c",
  "#b45309",
  "#16a34a",
  "#0d9488",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
];
const HIGHLIGHT_COLORS = [
  "#fef3c7",
  "#fde68a",
  "#fed7aa",
  "#fecaca",
  "#fbcfe8",
  "#e9d5ff",
  "#bfdbfe",
  "#a7f3d0",
  "#d9f99d",
  "#e5e7eb",
];

type BlockStyle = "paragraph" | "h1" | "h2" | "h3";

const BLOCK_STYLES: {
  value: BlockStyle;
  label: string;
  className: string;
  size: number;
}[] = [
  { value: "paragraph", label: "Normal text", className: "text-sm", size: 16 },
  {
    value: "h1",
    label: "Heading 1",
    className: "text-xl font-semibold",
    size: 32,
  },
  {
    value: "h2",
    label: "Heading 2",
    className: "text-base font-semibold",
    size: 22,
  },
  {
    value: "h3",
    label: "Heading 3",
    className: "text-sm font-semibold",
    size: 20,
  },
];

/** The native colour input only accepts #rrggbb; saved HTML reads back as rgb(). */
function toHex(color: string | null, fallback: string): string {
  if (!color) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!rgb) return fallback;
  return `#${rgb
    .slice(1, 4)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

const controlClass =
  "inline-flex h-7 items-center justify-center gap-1 rounded-ns px-1.5 font-ui text-xs text-ns-ink-secondary transition-colors hover:bg-ns-surface-hover hover:text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-ring)] disabled:opacity-40 disabled:pointer-events-none";

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keeps the selection in the manuscript while the button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`${controlClass} min-w-7 ${
        active ? "bg-ns-accent-subtle !text-ns-accent" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-ns-border" />;
}

function Swatches({
  colors,
  onPick,
}: {
  colors: string[];
  onPick: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5 px-2 py-1.5">
      {colors.map((color) => (
        <DropdownMenuItem
          key={color}
          aria-label={color}
          onSelect={() => onPick(color)}
          className="h-6 w-6 rounded-full border border-ns-border p-0 focus:ring-2 focus:ring-[var(--ns-ring)]"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export function FormatToolbar({
  editor,
  onLink,
  zoom,
  zoomPercent,
  onZoomChange,
  paragraphStyle,
  onParagraphStyleChange,
}: {
  editor: Editor;
  onLink: () => void;
  zoom: EditorZoom;
  zoomPercent: number;
  onZoomChange: (zoom: EditorZoom) => void;
  paragraphStyle: ParagraphStyle;
  onParagraphStyleChange: (style: ParagraphStyle) => void;
}) {
  const format = useFormatState(editor);
  const imageInput = useRef<HTMLInputElement>(null);

  const blockStyle =
    BLOCK_STYLES.find(
      (style) =>
        (style.value === "h1" && format.heading1) ||
        (style.value === "h2" && format.heading2) ||
        (style.value === "h3" && format.heading3),
    ) ?? BLOCK_STYLES[0];
  const font = findEditorFont(format.fontFamily);
  const fontSize = format.fontSize
    ? Math.round(parseFloat(format.fontSize))
    : blockStyle.size;

  const setBlockStyle = (value: string) => {
    const chain = editor.chain().focus();
    if (value === "paragraph") chain.setParagraph().run();
    else chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
  };

  const setFont = (label: string) => {
    const next = EDITOR_FONTS.find((option) => option.label === label);
    if (!next) return;
    if (next.value) editor.chain().focus().setFontFamily(next.value).run();
    else editor.chain().focus().unsetFontFamily().run();
  };

  const setFontSize = (size: number) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
    editor.chain().focus().setFontSize(`${clamped}px`).run();
  };

  // Radix returns focus to the trigger on close; send it back to the page.
  const menuProps = {
    align: "start" as const,
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      editor.commands.focus();
    },
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-shrink-0 flex-wrap items-center justify-center gap-0.5 border-b border-ns-border bg-ns-surface px-3 py-1.5"
    >
      <ToolbarButton
        label="Undo"
        disabled={!format.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={!format.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          title="Zoom"
          aria-label="Zoom"
          className={`${controlClass} w-16 justify-between tabular-nums`}
        >
          <span>{zoom === "fit" ? "Fit" : `${zoomPercent}%`}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent {...menuProps} className="min-w-24">
          <DropdownMenuRadioGroup
            value={String(zoom)}
            onValueChange={(value) =>
              onZoomChange(value === "fit" ? "fit" : Number(value))
            }
          >
            <DropdownMenuRadioItem value="fit">Fit</DropdownMenuRadioItem>
            <DropdownMenuSeparator />
            {ZOOM_LEVELS.map((level) => (
              <DropdownMenuRadioItem
                key={level}
                value={String(level)}
                className="tabular-nums"
              >
                {level}%
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      <DropdownMenu>
        <DropdownMenuTrigger
          title="Text style"
          aria-label="Text style"
          className={`${controlClass} w-28 justify-between`}
        >
          <span className="truncate">{blockStyle.label}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent {...menuProps} className="w-48">
          <DropdownMenuRadioGroup
            value={blockStyle.value}
            onValueChange={setBlockStyle}
          >
            {BLOCK_STYLES.map((style) => (
              <DropdownMenuRadioItem key={style.value} value={style.value}>
                <span className={style.className}>{style.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      <DropdownMenu>
        <DropdownMenuTrigger
          title="Font"
          aria-label="Font"
          className={`${controlClass} w-32 justify-between`}
        >
          <span className="truncate">{font.label}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          {...menuProps}
          className="max-h-80 w-52 overflow-y-auto"
        >
          <DropdownMenuRadioGroup value={font.label} onValueChange={setFont}>
            {EDITOR_FONTS.map((option) => (
              <DropdownMenuRadioItem key={option.label} value={option.label}>
                <span
                  className="text-sm"
                  style={
                    option.value ? { fontFamily: option.value } : undefined
                  }
                >
                  {option.label}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      <ToolbarButton
        label="Decrease font size"
        disabled={fontSize <= MIN_FONT_SIZE}
        onClick={() => setFontSize(fontSize - 1)}
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Font size"
          aria-label="Font size"
          className={`${controlClass} w-9 border border-ns-border tabular-nums`}
        >
          {fontSize}
        </DropdownMenuTrigger>
        <DropdownMenuContent {...menuProps} align="center" className="min-w-16">
          {FONT_SIZES.map((size) => (
            <DropdownMenuItem
              key={size}
              onSelect={() => setFontSize(size)}
              className="justify-center tabular-nums"
            >
              {size}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarButton
        label="Increase font size"
        disabled={fontSize >= MAX_FONT_SIZE}
        onClick={() => setFontSize(fontSize + 1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bold"
        active={format.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="text-sm font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={format.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="font-body text-sm italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={format.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="text-sm underline">U</span>
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={format.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="text-sm line-through">S</span>
      </ToolbarButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          title="Text colour"
          aria-label="Text colour"
          className={`${controlClass} min-w-7 flex-col !gap-0`}
        >
          <Baseline className="h-3.5 w-3.5" />
          <span
            className="h-[3px] w-4 rounded-full bg-ns-ink"
            style={format.color ? { backgroundColor: format.color } : undefined}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent {...menuProps} className="w-44">
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().unsetColor().run()}
          >
            Default
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <Swatches
            colors={TEXT_COLORS}
            onPick={(color) => editor.chain().focus().setColor(color).run()}
          />
          <DropdownMenuSeparator />
          <label className="flex items-center justify-between gap-2 px-2 py-1.5 font-ui text-xs text-ns-ink-secondary">
            Custom
            <input
              type="color"
              value={toHex(format.color, TEXT_COLORS[0])}
              onChange={(event) =>
                editor.chain().setColor(event.target.value).run()
              }
              className="h-6 w-8 cursor-pointer border-0 bg-transparent"
            />
          </label>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          title="Highlight colour"
          aria-label="Highlight colour"
          className={`${controlClass} min-w-7 flex-col !gap-0`}
        >
          <Highlighter className="h-3.5 w-3.5" />
          <span
            className="h-[3px] w-4 rounded-full bg-ns-border"
            style={
              format.highlightColor
                ? { backgroundColor: format.highlightColor }
                : undefined
            }
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent {...menuProps} className="w-44">
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().unsetHighlightColor().run()}
          >
            None
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <Swatches
            colors={HIGHLIGHT_COLORS}
            onPick={(color) =>
              editor.chain().focus().setHighlightColor(color).run()
            }
          />
          <DropdownMenuSeparator />
          <label className="flex items-center justify-between gap-2 px-2 py-1.5 font-ui text-xs text-ns-ink-secondary">
            Custom
            <input
              type="color"
              value={toHex(format.highlightColor, HIGHLIGHT_COLORS[0])}
              onChange={(event) =>
                editor.chain().setHighlightColor(event.target.value).run()
              }
              className="h-6 w-8 cursor-pointer border-0 bg-transparent"
            />
          </label>
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      <ToolbarButton label="Link" active={format.link} onClick={onLink}>
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Insert image"
        onClick={() => imageInput.current?.click()}
      >
        <ImagePlus className="h-4 w-4" />
      </ToolbarButton>
      <input
        ref={imageInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so picking the same file twice still fires a change.
          event.target.value = "";
          if (file) editor.commands.uploadImageFile(file);
        }}
      />

      <Divider />

      <ToolbarButton
        label="Align left"
        active={format.textAlign === "left"}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        active={format.textAlign === "center"}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Align right"
        active={format.textAlign === "right"}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Justify"
        active={format.textAlign === "justify"}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          title="Line & paragraph spacing"
          aria-label="Line and paragraph spacing"
          className={`${controlClass} min-w-7`}
        >
          <UnfoldVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent {...menuProps} className="w-56">
          <DropdownMenuLabel className="font-ui text-xs font-medium text-ns-ink-secondary">
            Line spacing
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={format.lineHeight ?? DEFAULT_LINE_HEIGHT}
            onValueChange={(value) =>
              editor.chain().focus().setLineHeight(value).run()
            }
          >
            {LINE_HEIGHTS.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {value}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-ui text-xs font-medium text-ns-ink-secondary">
            Space after paragraph
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={format.paragraphSpacing ?? DEFAULT_PARAGRAPH_SPACING}
            onValueChange={(value) =>
              editor.chain().focus().setParagraphSpacing(value).run()
            }
          >
            {PARAGRAPH_SPACINGS.map((spacing) => (
              <DropdownMenuRadioItem key={spacing.value} value={spacing.value}>
                {spacing.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-ui text-xs font-medium text-ns-ink-secondary">
            Paragraph style, whole story
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={paragraphStyle}
            onValueChange={(value) =>
              onParagraphStyleChange(value as ParagraphStyle)
            }
          >
            <DropdownMenuRadioItem value="spaced">
              Space between paragraphs
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="indented">
              First-line indent
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      <ToolbarButton
        label="Bullet list"
        active={format.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={format.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Decrease indent"
        onClick={() => editor.chain().focus().decreaseIndent().run()}
      >
        <IndentDecrease className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Increase indent"
        onClick={() => editor.chain().focus().increaseIndent().run()}
      >
        <IndentIncrease className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={format.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Scene break"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <SeparatorHorizontal className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Clear formatting"
        onClick={() => editor.chain().focus().clearTextFormatting().run()}
      >
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
