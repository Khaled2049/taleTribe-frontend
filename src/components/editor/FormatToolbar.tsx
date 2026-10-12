import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Quote,
  Redo2,
  RemoveFormatting,
  SeparatorHorizontal,
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
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useFormatState,
  type TextAlign,
} from "@/components/editor/useLiveEditorState";
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
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-ns px-1.5 font-ui text-xs text-ns-ink-secondary transition-colors hover:bg-ns-surface-hover hover:text-ns-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-ring)] disabled:opacity-40 disabled:pointer-events-none";

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
      className={`${controlClass} min-w-8 ${
        active ? "bg-ns-accent-subtle !text-ns-accent" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-ns-border" />;
}

function MoreSubmenu({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 font-ui text-xs">
        {label}
        {value && (
          <span className="ml-auto max-w-24 truncate text-ns-ink-muted">
            {value}
          </span>
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-56 overflow-y-auto">
          {children}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(true);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    // Side panels can narrow the editor even on a large screen.
    const observer = new ResizeObserver(([entry]) => {
      setCompact(entry.contentRect.width < 560);
    });
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

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

  const menuProps = {
    align: "start" as const,
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      editor.commands.focus();
    },
  };

  const styleChoices = (
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
  );
  const zoomLabel = zoom === "fit" ? "Fit" : `${zoomPercent}%`;
  const zoomChoices = (
    <DropdownMenuRadioGroup
      value={String(zoom)}
      onValueChange={(value) =>
        onZoomChange(value === "fit" ? "fit" : Number(value))
      }
    >
      <DropdownMenuRadioItem value="fit">Fit</DropdownMenuRadioItem>
      <DropdownMenuSeparator />
      {ZOOM_LEVELS.map((level) => (
        <DropdownMenuRadioItem key={level} value={String(level)}>
          {level}%
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
  const moreActions = [
    { label: "Link", icon: Link2, run: onLink },
    {
      label: "Insert image",
      icon: ImagePlus,
      run: () => imageInput.current?.click(),
    },
    {
      label: "Bullet list",
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      icon: Quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Formatting"
      className="flex min-w-0 flex-shrink-0 items-center gap-1 border-b border-ns-border bg-ns-surface px-2 py-1.5"
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

      {!compact && (
        <>
          <Divider />
          <DropdownMenu>
            <DropdownMenuTrigger
              title="Text style"
              aria-label="Text style"
              className={`${controlClass} w-28 justify-between`}
            >
              <span className="truncate">{blockStyle.label}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent {...menuProps} className="w-48">
              {styleChoices}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

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
        label="Scene break"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <SeparatorHorizontal className="h-4 w-4" />
      </ToolbarButton>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {!compact && (
          <DropdownMenu>
            <DropdownMenuTrigger
              title="Zoom"
              aria-label="Zoom"
              className={`${controlClass} w-16 justify-between tabular-nums`}
            >
              {zoomLabel}
              <ChevronDown className="h-3 w-3 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent {...menuProps} className="min-w-24">
              {zoomChoices}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            title="More formatting"
            aria-label="More formatting"
            className={`${controlClass} gap-1.5 border border-ns-border px-2`}
          >
            <MoreHorizontal className="h-4 w-4" />
            More
          </DropdownMenuTrigger>
          <DropdownMenuContent
            {...menuProps}
            align="end"
            collisionPadding={8}
            className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-60 overflow-y-auto"
          >
            {compact && (
              <>
                <MoreSubmenu label="Text style" value={blockStyle.label}>
                  {styleChoices}
                </MoreSubmenu>
                <MoreSubmenu label="Zoom" value={zoomLabel}>
                  {zoomChoices}
                </MoreSubmenu>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel className="font-ui text-xs text-ns-ink-muted">
              Text
            </DropdownMenuLabel>
            <MoreSubmenu label="Font" value={font.label}>
              <DropdownMenuRadioGroup
                value={font.label}
                onValueChange={setFont}
              >
                {EDITOR_FONTS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.label}
                    value={option.label}
                  >
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
            </MoreSubmenu>
            <MoreSubmenu label="Font size" value={String(fontSize)}>
              <DropdownMenuItem
                disabled={fontSize <= MIN_FONT_SIZE}
                onSelect={() => setFontSize(fontSize - 1)}
              >
                Decrease size
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={fontSize >= MAX_FONT_SIZE}
                onSelect={() => setFontSize(fontSize + 1)}
              >
                Increase size
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={String(fontSize)}
                onValueChange={(value) => setFontSize(Number(value))}
              >
                {FONT_SIZES.map((size) => (
                  <DropdownMenuRadioItem key={size} value={String(size)}>
                    {size}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </MoreSubmenu>
            <MoreSubmenu label="Text formatting">
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().toggleUnderline().run()}
              >
                {format.underline ? "Remove underline" : "Underline"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().toggleStrike().run()}
              >
                {format.strike ? "Remove strikethrough" : "Strikethrough"}
              </DropdownMenuItem>
            </MoreSubmenu>
            <MoreSubmenu label="Text colour">
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
            </MoreSubmenu>
            <MoreSubmenu label="Highlight colour">
              <DropdownMenuItem
                onSelect={() =>
                  editor.chain().focus().unsetHighlightColor().run()
                }
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
            </MoreSubmenu>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-ui text-xs text-ns-ink-muted">
              Paragraph
            </DropdownMenuLabel>
            <MoreSubmenu label="Alignment">
              <DropdownMenuRadioGroup
                value={format.textAlign}
                onValueChange={(value) =>
                  editor
                    .chain()
                    .focus()
                    .setTextAlign(value as TextAlign)
                    .run()
                }
              >
                {[
                  { value: "left", label: "Left", icon: AlignLeft },
                  { value: "center", label: "Center", icon: AlignCenter },
                  { value: "right", label: "Right", icon: AlignRight },
                  { value: "justify", label: "Justify", icon: AlignJustify },
                ].map(({ value, label, icon: Icon }) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </MoreSubmenu>
            <MoreSubmenu label="Spacing">
              <DropdownMenuLabel className="font-ui text-xs">
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
              <DropdownMenuLabel className="font-ui text-xs">
                Space after paragraph
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={format.paragraphSpacing ?? DEFAULT_PARAGRAPH_SPACING}
                onValueChange={(value) =>
                  editor.chain().focus().setParagraphSpacing(value).run()
                }
              >
                {PARAGRAPH_SPACINGS.map((spacing) => (
                  <DropdownMenuRadioItem
                    key={spacing.value}
                    value={spacing.value}
                  >
                    {spacing.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </MoreSubmenu>
            <MoreSubmenu label="Paragraph style">
              <DropdownMenuLabel className="font-ui text-xs">
                Whole story
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
            </MoreSubmenu>
            <MoreSubmenu label="Indent">
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().decreaseIndent().run()}
              >
                <IndentDecrease className="mr-2 h-4 w-4" />
                Decrease indent
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => editor.chain().focus().increaseIndent().run()}
              >
                <IndentIncrease className="mr-2 h-4 w-4" />
                Increase indent
              </DropdownMenuItem>
            </MoreSubmenu>
            <DropdownMenuSeparator />
            {moreActions.map(({ label, icon: Icon, run }) => (
              <DropdownMenuItem key={label} onSelect={run}>
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                editor.chain().focus().clearTextFormatting().run()
              }
            >
              <RemoveFormatting className="mr-2 h-4 w-4" />
              Clear formatting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <input
        ref={imageInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) editor.commands.uploadImageFile(file);
        }}
      />
    </div>
  );
}
