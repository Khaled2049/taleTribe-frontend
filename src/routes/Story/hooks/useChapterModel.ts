import { useMemo } from "react";
import {
  ChapterBlock,
  ChapterBlockKind,
  ChapterModel,
  FormatSpan,
} from "@/types/IReader";
import { extractFormattedText } from "@/lib/readerFormatting";

const ALLOWED_IMAGE_HOSTS = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
];

export function isSafeImageSrc(src: string): boolean {
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      ALLOWED_IMAGE_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

/**
 * Strip a raw selected word down to a look-up-able token while preserving
 * accented/Unicode letters (keeps letters, combining marks, apostrophes, hyphens).
 */
export function cleanWord(raw: string): string {
  return raw.trim().replace(/[^\p{L}\p{M}'-]/gu, "");
}

function blockAlign(node: Node): ChapterBlock["align"] {
  const align = (node as HTMLElement).style?.textAlign;
  return align === "center" || align === "right" ? align : undefined;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

const TEXT_BLOCK_KINDS: Record<string, ChapterBlockKind> = {
  P: "p",
  H1: "h1",
  H2: "h2",
  H3: "h3",
  H4: "h4",
  H5: "h5",
  H6: "h6",
  BLOCKQUOTE: "blockquote",
};

/**
 * Parse chapter HTML into an ordered list of blocks plus a canonical plain-text
 * string. Offsets are character indices into `plainText` (Option A: blocks are
 * concatenated with NO separators, so `Range.toString().length` over the
 * rendered container matches `plainText` exactly — see useReaderSelection).
 *
 * Pure and React-free so it can be unit-tested and memoized.
 */
export function buildChapterModel(content: string): ChapterModel {
  const blocks: ChapterBlock[] = [];
  const parts: string[] = [];
  let cursor = 0;
  let wordCount = 0;

  const parser = new DOMParser();
  const doc = parser.parseFromString(content ?? "", "text/html");
  const nodes = Array.from(doc.body.childNodes);

  const pushText = (kind: ChapterBlockKind, node: Node) => {
    const { text, spans } = extractFormattedText(node);
    if (!text) return;
    const align = blockAlign(node);
    const start = cursor;
    parts.push(text);
    cursor += text.length;
    blocks.push({
      key: `block-${blocks.length}`,
      kind,
      start,
      end: cursor,
      text,
      ...(spans.length ? { spans } : {}),
      ...(align ? { align } : {}),
    });
    wordCount += countWords(text);
  };

  for (const node of nodes) {
    const name = node.nodeName;

    if (name === "IMG") {
      const img = node as HTMLImageElement;
      const src = img.src;
      if (!src || !isSafeImageSrc(src)) continue;
      blocks.push({
        key: `block-${blocks.length}`,
        kind: "img",
        start: cursor,
        end: cursor,
        imgSrc: src,
        imgAlt: img.alt || "Story image",
      });
      continue;
    }

    if (name === "HR") {
      blocks.push({
        key: `block-${blocks.length}`,
        kind: "hr",
        start: cursor,
        end: cursor,
      });
      continue;
    }

    if (name === "UL" || name === "OL") {
      const items: {
        text: string;
        start: number;
        end: number;
        spans?: FormatSpan[];
      }[] = [];
      const listStart = cursor;
      for (const li of Array.from((node as HTMLElement).children)) {
        const { text, spans } = extractFormattedText(li);
        if (!text) continue;
        const start = cursor;
        parts.push(text);
        cursor += text.length;
        items.push({
          text,
          start,
          end: cursor,
          ...(spans.length ? { spans } : {}),
        });
        wordCount += countWords(text);
      }
      if (items.length === 0) continue;
      blocks.push({
        key: `block-${blocks.length}`,
        kind: name === "UL" ? "ul" : "ol",
        start: listStart,
        end: cursor,
        items,
      });
      continue;
    }

    pushText(TEXT_BLOCK_KINDS[name] ?? "div", node);
  }

  return { blocks, plainText: parts.join(""), wordCount };
}

/** Memoized chapter model — parses each chapter's HTML exactly once. */
export function useChapterModel(content: string): ChapterModel {
  return useMemo(() => buildChapterModel(content), [content]);
}
