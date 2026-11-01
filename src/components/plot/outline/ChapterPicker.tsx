import React from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type ChapterOption,
  UNASSIGNED,
  chapterFor,
  chapterIdFromSelect,
  chapterSelectValue,
} from "../plotChapters";

interface ChapterPickerProps {
  chapters: ChapterOption[];
  value: string | null;
  eventName: string;
  /** Saves at once: picking a chapter is the whole action. */
  onChange: (chapterId: string | null) => void;
}

const item =
  "py-1.5 pr-3 rounded-ns cursor-pointer font-ui text-sm text-ns-ink";

/** The event's chapter, shown on the card and changed in two clicks. */
export const ChapterPicker: React.FC<ChapterPickerProps> = ({
  chapters,
  value,
  eventName,
  onChange,
}) => {
  const current = chapterFor(chapters, value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Chapter for ${eventName}: ${current?.label ?? "none"}. Change chapter`}
        className={`inline-flex max-w-[14rem] items-center gap-1 rounded-full border px-2 py-0.5 font-ui text-[11px] transition-colors hover:border-ns-border-strong hover:text-ns-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent ${
          current
            ? "border-ns-border text-ns-ink-secondary"
            : "border-dashed border-ns-border-strong text-ns-ink-muted"
        }`}
      >
        <BookOpen className="h-3 w-3 flex-shrink-0" aria-hidden />
        <span className="truncate">{current?.label ?? "No chapter"}</span>
        <ChevronDown className="h-3 w-3 flex-shrink-0" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 min-w-[200px] overflow-y-auto rounded-ns-lg border border-ns-border bg-ns-elevated p-1 shadow-ns-lg"
      >
        <DropdownMenuRadioGroup
          value={chapterSelectValue(chapters, value)}
          onValueChange={(next) => onChange(chapterIdFromSelect(next))}
        >
          {chapters.map((chapter) => (
            <DropdownMenuRadioItem
              key={chapter.id}
              value={chapter.id}
              className={item}
            >
              <span className="truncate">{chapter.label}</span>
            </DropdownMenuRadioItem>
          ))}
          {chapters.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuRadioItem
            value={UNASSIGNED}
            className={`${item} text-ns-ink-secondary`}
          >
            No chapter
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {chapters.length === 0 && (
          <p className="px-3 py-2 font-ui text-xs text-ns-ink-muted">
            Write a chapter first to plan events into it.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
