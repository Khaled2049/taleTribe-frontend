import React from "react";
import {
  type ChapterOption,
  UNASSIGNED,
  chapterFor,
  chapterIdFromSelect,
  chapterSelectValue,
} from "./plotChapters";

interface ChapterSelectProps {
  id?: string;
  chapters: ChapterOption[];
  value: string | null | undefined;
  onChange: (chapterId: string | null) => void;
  className?: string;
  "aria-label"?: string;
}

export const ChapterSelect: React.FC<ChapterSelectProps> = ({
  id,
  chapters,
  value,
  onChange,
  className = "",
  "aria-label": ariaLabel,
}) => (
  <select
    id={id}
    aria-label={ariaLabel}
    title={chapterFor(chapters, value)?.label ?? "Unassigned"}
    value={chapterSelectValue(chapters, value)}
    onChange={(e) => onChange(chapterIdFromSelect(e.target.value))}
    className={`min-w-0 truncate ${className}`}
  >
    <option value={UNASSIGNED}>Unassigned</option>
    {chapters.map((chapter) => (
      <option key={chapter.id} value={chapter.id}>
        {chapter.label}
      </option>
    ))}
  </select>
);
