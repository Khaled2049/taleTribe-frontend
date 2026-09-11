// src/components/reader/ReaderContent.tsx

import React, { useMemo } from "react";
import { ChapterModel, RenderMark } from "@/types/IReader";
import { READER_FONTS } from "../../constants/readerThemes";
import { ChapterContentRenderer } from "./ChapterContentRenderer";

interface ReaderContentProps {
  title: string;
  model: ChapterModel;
  marks: RenderMark[];
  activeMarkRef: React.RefObject<HTMLElement | null>;
  /** Ref onto the content body only (excludes the title) for selection offsets. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  fontSize: number;
  fontFamily: keyof typeof READER_FONTS;
  lineHeight: number;
  textAlign: "left" | "justify";
  onWordClick: (word: string, x: number, y: number) => void;
  onHighlightClick: (id: string, x: number, y: number) => void;
}

const ReaderContentBase: React.FC<ReaderContentProps> = ({
  title,
  model,
  marks,
  activeMarkRef,
  containerRef,
  fontSize,
  fontFamily,
  lineHeight,
  textAlign,
  onWordClick,
  onHighlightClick,
}) => {
  const contentStyle = useMemo(
    () => ({
      fontSize: `${fontSize}px`,
      fontFamily: READER_FONTS[fontFamily],
      lineHeight,
      textAlign,
    }),
    [fontSize, fontFamily, lineHeight, textAlign],
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
      <div className="py-8">
        {title && (
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-8 text-center">
            {title}
          </h1>
        )}

        {/* Chapter Content (selection offsets are measured against this div) */}
        <div ref={containerRef} style={contentStyle}>
          <ChapterContentRenderer
            model={model}
            marks={marks}
            activeMarkRef={activeMarkRef}
            onWordClick={onWordClick}
            onHighlightClick={onHighlightClick}
          />
        </div>
      </div>
    </div>
  );
};

export const ReaderContent = React.memo(ReaderContentBase);
