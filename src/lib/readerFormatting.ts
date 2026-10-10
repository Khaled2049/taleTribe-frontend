import type { ParagraphStyle } from "@novelsync/story-data-client";
import type { ChapterBlock, FormatSpan, RenderMark } from "@/types/IReader";

/** The slice of the DOM `Node` interface this module reads. */
export interface FormatNode {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  childNodes: ArrayLike<FormatNode>;
}

const TEXT_NODE = 3;
const BOLD = 1;
const ITALIC = 2;
const UNDERLINE = 4;
const STRIKE = 8;

const TAG_FORMAT: Record<string, number> = {
  STRONG: BOLD,
  B: BOLD,
  EM: ITALIC,
  I: ITALIC,
  U: UNDERLINE,
  S: STRIKE,
  DEL: STRIKE,
  STRIKE: STRIKE,
};

/**
 * A block's text plus the bold/italic/underline/strike ranges inside it.
 *
 * `text` must stay identical to `textContent.replace(/\s+/g, " ").trim()`:
 * saved highlights and search are character offsets into that string, so the
 * whitespace collapsing is reproduced here rather than changed.
 */
export function extractFormattedText(root: FormatNode): {
  text: string;
  spans: FormatSpan[];
} {
  let text = "";
  const runs: { start: number; end: number; bits: number }[] = [];
  let pendingSpace = false;
  let pendingBits = 0;

  const emit = (char: string, bits: number) => {
    if (bits) {
      const last = runs[runs.length - 1];
      if (last && last.end === text.length && last.bits === bits) last.end += 1;
      else runs.push({ start: text.length, end: text.length + 1, bits });
    }
    text += char;
  };

  const walk = (node: FormatNode, bits: number) => {
    if (node.nodeType === TEXT_NODE) {
      const value = node.nodeValue ?? "";
      for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (/\s/.test(char)) {
          if (!text) continue;
          // A collapsed gap is formatted only if both sides of it are.
          pendingBits = pendingSpace ? pendingBits & bits : bits;
          pendingSpace = true;
          continue;
        }
        if (pendingSpace) {
          emit(" ", pendingBits & bits);
          pendingSpace = false;
        }
        emit(char, bits);
      }
      return;
    }
    const own = bits | (TAG_FORMAT[node.nodeName] ?? 0);
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i], own);
    }
  };
  walk(root, 0);

  return {
    text,
    spans: runs.map(({ start, end, bits }) => ({
      start,
      end,
      ...(bits & BOLD ? { bold: true } : {}),
      ...(bits & ITALIC ? { italic: true } : {}),
      ...(bits & UNDERLINE ? { underline: true } : {}),
      ...(bits & STRIKE ? { strike: true } : {}),
    })),
  };
}

export function formatClassName(span: FormatSpan | undefined): string {
  if (!span) return "";
  // Tailwind's underline and line-through set the same property, so one wins.
  const decoration =
    span.underline && span.strike
      ? "[text-decoration-line:underline_line-through]"
      : span.underline
        ? "underline"
        : span.strike
          ? "line-through"
          : "";
  return [span.bold && "font-bold", span.italic && "italic", decoration]
    .filter(Boolean)
    .join(" ");
}

type Segment = { key: string; text: string; format?: FormatSpan } & (
  | { kind: "text" }
  | { kind: "search"; active: boolean }
  | {
      kind: "highlight";
      color: NonNullable<RenderMark["color"]>;
      id: string;
    }
);

/**
 * Split a block's local text into consecutive styled segments based on the
 * global `marks` that overlap it and the block-local formatting `spans`.
 * Search marks win visually over highlights.
 */
export function buildSegments(
  text: string,
  blockStart: number,
  marks: RenderMark[],
  blockKey: string,
  spans: FormatSpan[] = [],
): Segment[] {
  const blockEnd = blockStart + text.length;

  // Clip marks to this block, in local coordinates.
  const local = marks
    .map((m) => ({
      lo: Math.max(m.start, blockStart) - blockStart,
      hi: Math.min(m.end, blockEnd) - blockStart,
      mark: m,
    }))
    .filter((m) => m.hi > m.lo);

  if (local.length === 0 && spans.length === 0) {
    return [{ kind: "text", key: `seg-${blockKey}-0`, text }];
  }

  // Boundary points partition [0, text.length) into atomic intervals.
  const points = new Set<number>([0, text.length]);
  for (const m of local) {
    points.add(m.lo);
    points.add(m.hi);
  }
  for (const span of spans) {
    points.add(span.start);
    points.add(span.end);
  }
  const sorted = [...points].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b <= a) continue;
    const slice = text.slice(a, b);
    const key = `seg-${blockKey}-${a}`;
    const covering = local.filter((m) => m.lo <= a && m.hi >= b);
    const format = spans.find((span) => span.start <= a && span.end >= b);

    const searchMark = covering.find((m) => m.mark.kind === "search");
    if (searchMark) {
      segments.push({
        kind: "search",
        key,
        text: slice,
        format,
        active: covering.some((m) => m.mark.kind === "search" && m.mark.active),
      });
      continue;
    }

    // Topmost highlight = last in array order (search is appended after).
    const highlightMark = [...covering]
      .reverse()
      .find((m) => m.mark.kind === "highlight");
    if (highlightMark && highlightMark.mark.color && highlightMark.mark.id) {
      segments.push({
        kind: "highlight",
        key,
        text: slice,
        format,
        color: highlightMark.mark.color,
        id: highlightMark.mark.id,
      });
      continue;
    }

    segments.push({ kind: "text", key, text: slice, format });
  }

  return segments;
}

/**
 * Margin and indent for the paragraph at `index`. Matches the editor's rule in
 * style.css: with "indented", only a paragraph that follows another is
 * indented, and the gap returns before anything that is not a paragraph.
 */
export function paragraphClassName(
  blocks: readonly ChapterBlock[],
  index: number,
  style: ParagraphStyle,
): string {
  if (style === "spaced") return "mb-6";
  const followsParagraph = blocks[index - 1]?.kind === "p";
  const precedesParagraph = blocks[index + 1]?.kind === "p";
  const indent = followsParagraph && !blocks[index].align;
  return `${precedesParagraph ? "mb-0" : "mb-6"}${indent ? " indent-[1.5em]" : ""}`;
}
