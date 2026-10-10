// src/components/reader/ChapterContentRenderer.tsx

import React, { JSX, useCallback } from "react";
import {
  ChapterBlock,
  ChapterModel,
  FormatSpan,
  RenderMark,
} from "@/types/IReader";
import {
  buildSegments,
  formatClassName,
  paragraphClassName,
} from "@/lib/readerFormatting";
import type { ParagraphStyle } from "@novelsync/story-data-client";
import { HIGHLIGHT_COLORS } from "../../constants/readerThemes";
import { cleanWord } from "../../hooks/useChapterModel";

interface ChapterContentRendererProps {
  model: ChapterModel;
  marks: RenderMark[];
  paragraphStyle?: ParagraphStyle;
  /** Ref attached to the active search match for scrollIntoView. */
  activeMarkRef: React.RefObject<HTMLElement | null>;
  onWordClick: (word: string, x: number, y: number) => void;
  onHighlightClick: (id: string, x: number, y: number) => void;
}

const SEARCH_CLASS = "bg-amber-300/70 text-black rounded-[2px]";
const SEARCH_ACTIVE_CLASS =
  "bg-amber-400 text-black ring-2 ring-amber-500 rounded-[2px] scroll-mt-24";

const ChapterContentRendererBase: React.FC<ChapterContentRendererProps> = ({
  model,
  marks,
  paragraphStyle = "spaced",
  activeMarkRef,
  onWordClick,
  onHighlightClick,
}) => {
  const handleDoubleClick = useCallback(() => {
    const selection = window.getSelection();
    const word = cleanWord(selection?.toString() ?? "");
    if (!word) return;
    const range = selection?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();
    if (rect) {
      onWordClick(word, rect.left + rect.width / 2, rect.top - 10);
    }
  }, [onWordClick]);

  const renderSegments = useCallback(
    (
      text: string,
      blockStart: number,
      blockKey: string,
      spans?: FormatSpan[],
    ) => {
      const segments = buildSegments(text, blockStart, marks, blockKey, spans);
      return segments.map((seg) => {
        const formatClass = formatClassName(seg.format);
        if (seg.kind === "search") {
          return (
            <mark
              key={seg.key}
              ref={
                seg.active
                  ? (activeMarkRef as React.RefObject<HTMLElement>)
                  : undefined
              }
              data-active={seg.active ? "true" : undefined}
              className={`${seg.active ? SEARCH_ACTIVE_CLASS : SEARCH_CLASS} ${formatClass}`}
            >
              {seg.text}
            </mark>
          );
        }
        if (seg.kind === "highlight") {
          return (
            <mark
              key={seg.key}
              data-highlight-id={seg.id}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onHighlightClick(seg.id, e.clientX, e.clientY);
              }}
              className={`${HIGHLIGHT_COLORS[seg.color]} text-black rounded-[2px] cursor-pointer ${formatClass}`}
            >
              {seg.text}
            </mark>
          );
        }
        if (formatClass) {
          return (
            <span key={seg.key} className={formatClass}>
              {seg.text}
            </span>
          );
        }
        return <React.Fragment key={seg.key}>{seg.text}</React.Fragment>;
      });
    },
    [marks, activeMarkRef, onHighlightClick],
  );

  const renderBlock = (block: ChapterBlock, index: number) => {
    const { key } = block;
    const style = block.align ? { textAlign: block.align } : undefined;
    switch (block.kind) {
      // The ornament is generated content, not text: selection offsets are
      // measured over rendered text and must not see it.
      case "hr":
        return (
          <hr
            key={key}
            className="my-10 h-auto overflow-visible border-0 text-center opacity-60 after:tracking-[0.4em] after:content-['*_*_*']"
          />
        );

      case "img":
        return block.imgSrc ? (
          <div key={key} className="flex justify-center my-8">
            <img
              src={block.imgSrc}
              alt={block.imgAlt}
              className="max-w-full h-auto rounded-lg shadow-lg"
              loading="lazy"
            />
          </div>
        ) : null;

      case "ul":
      case "ol": {
        const ListTag = block.kind;
        return (
          <ListTag key={key} className="mb-6">
            {(block.items ?? []).map((item, i) => (
              <li
                key={`${key}-li-${i}`}
                className={`ml-6 mb-2 text-current ${block.kind === "ul" ? "list-disc" : "list-decimal"}`}
              >
                {renderSegments(
                  item.text,
                  item.start,
                  `${key}-li-${i}`,
                  item.spans,
                )}
              </li>
            ))}
          </ListTag>
        );
      }

      case "blockquote":
        return (
          <blockquote
            key={key}
            className="border-l-4 border-current opacity-70 pl-4 italic my-6 text-current"
            style={style}
          >
            {renderSegments(block.text ?? "", block.start, key, block.spans)}
          </blockquote>
        );

      case "p":
        return (
          <p
            key={key}
            className={paragraphClassName(model.blocks, index, paragraphStyle)}
            style={style}
          >
            {renderSegments(block.text ?? "", block.start, key, block.spans)}
          </p>
        );

      case "div":
        return (
          <div key={key} className="mb-2" style={style}>
            {renderSegments(block.text ?? "", block.start, key, block.spans)}
          </div>
        );

      default:
        return React.createElement(
          block.kind as keyof JSX.IntrinsicElements,
          { key, className: "font-bold mb-4 mt-8 text-current", style },
          renderSegments(block.text ?? "", block.start, key, block.spans),
        );
    }
  };

  return (
    <div className="select-text" onDoubleClick={handleDoubleClick}>
      {model.blocks.map(renderBlock)}
    </div>
  );
};

export const ChapterContentRenderer = React.memo(ChapterContentRendererBase);
