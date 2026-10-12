export interface Chapter {
  id: string;
  title: string;
  content: string;
}

export interface Highlight {
  id: string;
  chapterId: string;
  text: string;
  color: "yellow" | "green" | "blue" | "pink";
  note?: string;
  position: {
    start: number;
    end: number;
  };
  createdAt: Date;
}

/**
 * `voiceURI` of a browser SpeechSynthesis voice. Not a closed union: the list is
 * whatever the user's OS/browser exposes, and a persisted value may not exist on
 * another device — consumers fall back to the browser default.
 */
export type TtsVoiceId = string;

export interface ReaderSettings {
  fontSize: number;
  fontFamily: "serif" | "sans" | "mono" | "palatino" | "bookerly";
  lineHeight: number;
  theme: "light" | "dark" | "sepia";
  textAlign: "left" | "justify";
  ttsVoice: TtsVoiceId;
  /** Speaking speed multiplier (0.5–2.0). */
  ttsSpeed: number;
}

export interface WordDefinition {
  word: string;
  definition: string;
  partOfSpeech: string;
  examples?: string[];
}

export interface SearchResult {
  index: number;
  context: string;
}

/** A half-open character range [start, end) into a chapter's plain text. */
export interface MarkableRange {
  start: number;
  end: number;
}

export type ChapterBlockKind =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "blockquote"
  | "ul"
  | "ol"
  | "img"
  | "hr"
  | "div";

/** Inline formatting over [start, end) of one block's or list item's text. */
export interface FormatSpan {
  start: number;
  end: number;
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
}

/**
 * One top-level block of a parsed chapter. `start`/`end` are global offsets
 * into the chapter's `plainText`. Text blocks carry normalized `text`; lists
 * carry `items`; images carry `imgSrc`/`imgAlt` and an empty [start, end) range,
 * as do dividers (`hr`). `spans` are local to the block's or item's own text.
 */
export interface ChapterBlock {
  key: string;
  kind: ChapterBlockKind;
  start: number;
  end: number;
  text?: string;
  spans?: FormatSpan[];
  /** Set only where the writer overrode the reader's own alignment. */
  align?: "center" | "right";
  items?: { text: string; start: number; end: number; spans?: FormatSpan[] }[];
  imgSrc?: string;
  imgAlt?: string;
}

/** Parsed-once representation of a chapter, the source of truth for offsets. */
export interface ChapterModel {
  blocks: ChapterBlock[];
  plainText: string;
  wordCount: number;
}

/** A range to visually mark in the rendered text (search match or highlight). */
export interface RenderMark {
  start: number;
  end: number;
  kind: "search" | "highlight";
  /** Highlight colour (highlight marks only). */
  color?: Highlight["color"];
  /** Highlight id, or `search-${i}` for search matches. */
  id?: string;
  /** The active (focused) search match. */
  active?: boolean;
}

export interface TextSelection {
  text: string;
  range: Range;
}

export interface MenuPosition {
  x: number;
  y: number;
}
