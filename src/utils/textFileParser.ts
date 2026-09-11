import {
  CHAPTER_WORD_LIMIT,
  STORY_CHAPTER_LIMIT,
} from "@/utils/chapterWordLimit";

export interface ParsedChapter {
  title: string;
  content: string;
  wordCount: number;
}

export interface ParseResult {
  chapters: ParsedChapter[];
  warnings: string[];
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Patterns that identify a line as a chapter heading.
// Each pattern must match from the start of the (trimmed) line.
const WORD_NUMBERS =
  "one|two|three|four|five|six|seven|eight|nine|ten|" +
  "eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty";

const CHAPTER_HEADING_PATTERNS: RegExp[] = [
  /^chapter\s+\d+/i,
  /^chapter\s+[ivxlcdm]+\.?\b/i,
  new RegExp(`^chapter\\s+(?:${WORD_NUMBERS})\\b`, "i"),
  /^ch\.\s*\d+/i,
  /^part\s+\d+/i,
  /^part\s+[ivxlcdm]+\.?\b/i,
  new RegExp(`^part\\s+(?:${WORD_NUMBERS})\\b`, "i"),
  /^log\s+\d+/i,
  /^log\s+[ivxlcdm]+\.?\b/i,
  new RegExp(`^log\\s+(?:${WORD_NUMBERS})\\b`, "i"),
  /^entry\s+\d+/i,
  /^entry\s+[ivxlcdm]+\.?\b/i,
  new RegExp(`^entry\\s+(?:${WORD_NUMBERS})\\b`, "i"),
  /^scene\s+\d+/i,
  /^section\s+\d+/i,
  /^prologue\b/i,
  /^epilogue\b/i,
  /^introduction\b/i,
  /^preface\b/i,
  /^afterword\b/i,
];

// Maximum length of a chapter heading line. Long lines are body text, not headings.
const MAX_HEADING_LENGTH = 120;

/**
 * Returns the trimmed line if it looks like a chapter heading, otherwise null.
 */
function detectHeading(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING_LENGTH) return null;
  for (const pattern of CHAPTER_HEADING_PATTERNS) {
    if (pattern.test(trimmed)) return trimmed;
  }
  return null;
}

/**
 * Escapes characters that have special meaning in HTML.
 * This prevents any HTML/script injection from the uploaded file.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Converts a plain-text block into minimal HTML suitable for the TipTap editor.
 * Paragraphs are delimited by blank lines; single newlines become spaces.
 */
function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "<p></p>";
  return paragraphs
    .map((p) => `<p>${escapeHtml(p.replace(/\n/g, " "))}</p>`)
    .join("");
}

/**
 * Counts words in a plain-text string.
 */
function countWordsInText(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates an uploaded file before reading it.
 * Returns an error message string on failure, or null on success.
 */
export function validateTextFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    return `File is too large (${sizeMb} MB). Maximum allowed size is 5 MB.`;
  }

  // Accept text/plain MIME type; also allow empty MIME (some OS/browsers omit it)
  if (file.type && file.type !== "text/plain") {
    return "Only plain text (.txt) files are supported.";
  }

  if (!file.name.toLowerCase().endsWith(".txt")) {
    return "Only plain text (.txt) files are supported.";
  }

  return null;
}

/**
 * Parses the plain-text content of an uploaded file into chapters.
 * - Detects chapter headings using common patterns.
 * - Falls back to a single "Chapter 1" if no headings are found.
 * - Truncates chapters that exceed the word limit.
 * - Caps the total number of chapters.
 * - All content is HTML-escaped before wrapping in <p> tags.
 */
export function parseTextFile(fileContent: string): ParseResult {
  const warnings: string[] = [];

  // Normalise line endings
  const normalised = fileContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalised.split("\n");

  // Locate chapter heading lines
  const breaks: Array<{ lineIndex: number; title: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const heading = detectHeading(lines[i]);
    if (heading) {
      breaks.push({ lineIndex: i, title: heading });
    }
  }

  // Build raw chapter objects (title + plain text body)
  let rawChapters: Array<{ title: string; text: string }>;

  if (breaks.length === 0) {
    rawChapters = [{ title: "Chapter 1", text: normalised }];
  } else {
    rawChapters = breaks.map((b, idx) => {
      const bodyStart = b.lineIndex + 1;
      const bodyEnd =
        idx < breaks.length - 1 ? breaks[idx + 1].lineIndex : lines.length;
      return {
        title: b.title,
        text: lines.slice(bodyStart, bodyEnd).join("\n"),
      };
    });
  }

  // Enforce chapter limit
  if (rawChapters.length > STORY_CHAPTER_LIMIT) {
    warnings.push(
      `File contains ${rawChapters.length} chapters. Only the first ${STORY_CHAPTER_LIMIT} will be imported.`,
    );
    rawChapters = rawChapters.slice(0, STORY_CHAPTER_LIMIT);
  }

  // Convert each chapter to HTML and apply word limit
  const chapters: ParsedChapter[] = rawChapters.map((raw) => {
    const rawWordCount = countWordsInText(raw.text);
    let text = raw.text;

    if (rawWordCount > CHAPTER_WORD_LIMIT) {
      const words = raw.text.trim().split(/\s+/);
      text = words.slice(0, CHAPTER_WORD_LIMIT).join(" ");
      warnings.push(
        `"${raw.title}" exceeded the ${CHAPTER_WORD_LIMIT.toLocaleString()}-word limit and was truncated (${rawWordCount.toLocaleString()} → ${CHAPTER_WORD_LIMIT.toLocaleString()} words).`,
      );
    }

    return {
      title: raw.title,
      content: textToHtml(text),
      wordCount: Math.min(rawWordCount, CHAPTER_WORD_LIMIT),
    };
  });

  return { chapters, warnings };
}
