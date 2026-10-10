export interface EditorFont {
  label: string;
  /** CSS font stack; null is the canvas default set in style.css. */
  value: string | null;
}

export const DEFAULT_EDITOR_FONT: EditorFont = {
  label: "Default",
  value: null,
};

export const EDITOR_FONTS: EditorFont[] = [
  DEFAULT_EDITOR_FONT,
  { label: "Crimson Pro", value: "'Crimson Pro', Georgia, serif" },
  { label: "EB Garamond", value: "'EB Garamond', Garamond, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  {
    label: "Libre Baskerville",
    value: "'Libre Baskerville', Baskerville, serif",
  },
  { label: "Lora", value: "Lora, Georgia, serif" },
  { label: "Merriweather", value: "Merriweather, Georgia, serif" },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  {
    label: "Courier Prime",
    value: "'Courier Prime', 'Courier New', monospace",
  },
];

// Chapters saved before the default became "no mark" carry this stack inline.
const LEGACY_DEFAULT_FAMILY = "-apple-system";

function primaryFamily(stack: string): string {
  return stack.split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
}

/**
 * Matches on the first family only: the browser re-quotes and re-spaces a
 * stack when it parses saved HTML, so the stored string never equals `value`.
 */
export function findEditorFont(stored: string | null | undefined): EditorFont {
  if (!stored) return DEFAULT_EDITOR_FONT;
  const family = primaryFamily(stored);
  if (family === LEGACY_DEFAULT_FAMILY) return DEFAULT_EDITOR_FONT;
  return (
    EDITOR_FONTS.find(
      (font) => font.value && primaryFamily(font.value) === family,
    ) ?? {
      label: stored.split(",")[0].replace(/['"]/g, "").trim(),
      value: stored,
    }
  );
}

// Crimson Pro is already in index.html; the rest load only on the editor page.
const EDITOR_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=Merriweather:ital,wght@0,400;0,700;1,400;1,700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:ital,wght@0,400;0,700;1,400;1,700&family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap";
const EDITOR_FONTS_LINK_ID = "editor-fonts";

export function loadEditorFonts(): void {
  if (document.getElementById(EDITOR_FONTS_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = EDITOR_FONTS_LINK_ID;
  link.rel = "stylesheet";
  link.href = EDITOR_FONTS_URL;
  document.head.appendChild(link);
}
