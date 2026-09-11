import React, { useRef, useEffect, useState } from "react";
import {
  BookOpen,
  Trash2,
  Pencil,
  Plus,
  Heading,
  SplitSquareVertical,
} from "lucide-react";
import { Chapter } from "@novelsync/story-data-client";
import type { OutlineEntry } from "@/utils/documentOutline";
import { STORY_CHAPTER_LIMIT } from "@/utils/chapterWordLimit";

interface SidebarPanelProps {
  chapters: Chapter[];
  currentChapterId: string;
  chapterTitle: string;
  storyTitle: string;
  onChapterSelect: (chapter: Chapter) => void;
  onChapterDelete: (chapterId: string) => void;
  onChapterAdd?: () => void;
  chapterLimit?: number;
  onStoryTitleChange: (title: string) => void;
  onChapterTitleChange: (title: string) => void;
  onMetadataChange: () => void;
  singleDocument?: boolean;
  outline?: OutlineEntry[];
  onOutlineSelect?: (entry: OutlineEntry) => void;
  canSplitIntoChapters?: boolean;
  onSplitIntoChapters?: () => void;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  chapters,
  currentChapterId,
  chapterTitle,
  storyTitle,
  onChapterSelect,
  onChapterDelete,
  onChapterAdd,
  chapterLimit = STORY_CHAPTER_LIMIT,
  onStoryTitleChange,
  onChapterTitleChange,
  onMetadataChange,
  singleDocument = false,
  outline = [],
  onOutlineSelect,
  canSplitIntoChapters = false,
  onSplitIntoChapters,
}) => {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onMetadataChange();
      debounceTimerRef.current = null;
    }, 1000);
  };

  const clearScheduledSave = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  const flushSave = () => {
    clearScheduledSave();
    onMetadataChange();
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const hasChapter = Boolean(currentChapterId);

  return (
    <div className="h-full flex flex-col bg-ns-surface">
      <div className="flex-shrink-0 px-4 pt-5 pb-4 space-y-1 border-b border-ns-border">
        <InlineTitle
          value={storyTitle}
          placeholder="Untitled story"
          ariaLabel="Story title"
          onChange={onStoryTitleChange}
          onType={scheduleSave}
          onCommit={flushSave}
          onCancel={clearScheduledSave}
          className="font-heading text-xl font-bold text-ns-ink"
        />
        {hasChapter && !singleDocument && (
          <InlineTitle
            value={chapterTitle}
            placeholder="Untitled chapter"
            ariaLabel="Chapter title"
            onChange={onChapterTitleChange}
            onType={scheduleSave}
            onCommit={flushSave}
            onCancel={clearScheduledSave}
            className="font-ui text-sm text-ns-ink-secondary"
            iconSize="w-3.5 h-3.5"
          />
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0 px-4 pt-4 pb-2">
          <span className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
            {singleDocument
              ? `Outline — ${outline.length}`
              : `Chapters — ${chapters.length}`}
          </span>
          {onChapterAdd && (
            <button
              onClick={onChapterAdd}
              disabled={chapters.length >= chapterLimit}
              title={
                chapters.length >= chapterLimit
                  ? `Chapter limit reached (${chapterLimit})`
                  : singleDocument
                    ? "Add a chapter"
                    : "Add chapter"
              }
              aria-label="Add chapter"
              className="inline-flex items-center justify-center w-6 h-6 rounded-ns text-ns-ink-muted hover:text-ns-accent hover:bg-ns-accent-subtle active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {singleDocument ? (
          <OutlinePane
            outline={outline}
            onOutlineSelect={onOutlineSelect}
            canSplitIntoChapters={canSplitIntoChapters}
            onSplitIntoChapters={onSplitIntoChapters}
            onChapterAdd={onChapterAdd}
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {chapters.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <div className="w-12 h-12 rounded-full bg-ns-accent-subtle flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-ns-accent opacity-60" />
                </div>
                <p className="font-ui text-xs text-ns-ink-muted text-center leading-relaxed">
                  No chapters yet.
                  <br />
                  Create your first chapter.
                </p>
                {onChapterAdd && (
                  <button
                    onClick={onChapterAdd}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns bg-ns-accent text-white font-ui text-xs font-medium hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150 shadow-ns-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Chapter
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-px">
                {chapters.map((chapter) => {
                  const isActive = currentChapterId === chapter.id;
                  return (
                    <div
                      key={chapter.id}
                      className={`group relative flex items-center rounded-ns transition-colors duration-150 ${
                        isActive
                          ? "bg-ns-accent-subtle"
                          : "hover:bg-ns-surface-hover"
                      }`}
                    >
                      <button
                        onClick={() => onChapterSelect(chapter)}
                        aria-current={isActive ? "true" : undefined}
                        className="flex-1 flex items-center gap-2.5 text-left px-3 py-2 min-w-0"
                      >
                        <span
                          aria-hidden="true"
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-150 ${
                            isActive ? "bg-ns-accent" : "bg-ns-border-strong"
                          }`}
                        />
                        <span
                          className={`font-ui text-sm truncate transition-colors duration-150 ${
                            isActive
                              ? "font-semibold text-ns-ink"
                              : "text-ns-ink-secondary group-hover:text-ns-ink"
                          }`}
                        >
                          {chapter.title || "Untitled"}
                        </span>
                      </button>

                      <span className="hidden lg:block pr-3 font-ui text-[10px] text-ns-ink-muted tabular-nums group-hover:invisible">
                        {(chapter.wordCount || 0).toLocaleString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChapterDelete(chapter.id);
                        }}
                        aria-label={`Delete ${chapter.title || "Untitled"}`}
                        className="flex-shrink-0 p-2 text-ns-ink-muted hover:text-ns-destructive transition-colors duration-150 lg:absolute lg:right-1 lg:invisible lg:group-hover:visible lg:focus-visible:visible"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function OutlinePane({
  outline,
  onOutlineSelect,
  canSplitIntoChapters,
  onSplitIntoChapters,
  onChapterAdd,
}: {
  outline: OutlineEntry[];
  onOutlineSelect?: (entry: OutlineEntry) => void;
  canSplitIntoChapters: boolean;
  onSplitIntoChapters?: () => void;
  onChapterAdd?: () => void;
}) {
  const topLevel = outline.length
    ? Math.min(...outline.map((entry) => entry.level))
    : 1;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {outline.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <div className="w-12 h-12 rounded-full bg-ns-accent-subtle flex items-center justify-center">
              <Heading className="w-5 h-5 text-ns-accent opacity-60" />
            </div>
            <p className="font-ui text-xs text-ns-ink-muted text-center leading-relaxed px-4">
              One document — add a heading to outline it.
            </p>
            {onChapterAdd && (
              <button
                onClick={onChapterAdd}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns bg-ns-accent text-white font-ui text-xs font-medium hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150 shadow-ns-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New Chapter
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-px">
            {outline.map((entry, index) => (
              <button
                key={`${entry.pos}-${index}`}
                onClick={() => onOutlineSelect?.(entry)}
                className="group w-full flex items-center gap-2.5 text-left rounded-ns px-3 py-2 min-w-0 hover:bg-ns-surface-hover transition-colors duration-150"
                style={{
                  paddingLeft: `${12 + (entry.level - topLevel) * 14}px`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-ns-border-strong group-hover:bg-ns-accent transition-colors duration-150"
                />
                <span className="font-ui text-sm truncate text-ns-ink-secondary group-hover:text-ns-ink transition-colors duration-150">
                  {entry.text || "Untitled section"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {onSplitIntoChapters && canSplitIntoChapters && (
        <div className="flex-shrink-0 border-t border-ns-border px-3 py-2.5">
          <button
            onClick={onSplitIntoChapters}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-ns border border-ns-border px-3 py-1.5 font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink hover:border-ns-border-strong transition-colors duration-150"
          >
            <SplitSquareVertical className="w-3.5 h-3.5 flex-shrink-0" />
            Split into chapters
          </button>
        </div>
      )}
    </div>
  );
}

function InlineTitle({
  value,
  placeholder,
  ariaLabel,
  onChange,
  onType,
  onCommit,
  onCancel,
  className,
  iconSize = "w-4 h-4",
  maxLength = 80,
}: {
  value: string;
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onType: () => void;
  onCommit: () => void;
  onCancel: () => void;
  className: string;
  iconSize?: string;
  maxLength?: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const valueAtEditStart = useRef(value);
  const isFinishing = useRef(false);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    isFinishing.current = false;
    valueAtEditStart.current = value;
    setIsEditing(true);
  };

  const commit = () => {
    if (isFinishing.current) return;
    isFinishing.current = true;
    setIsEditing(false);
    onCommit();
  };

  const cancel = () => {
    if (isFinishing.current) return;
    isFinishing.current = true;
    onCancel();
    onChange(valueAtEditStart.current);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        aria-label={ariaLabel}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          onType();
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className={`w-full bg-transparent border-b border-ns-accent px-0 py-0.5 text-ns-ink placeholder:text-ns-ink-muted focus:outline-none ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title={`Rename — ${ariaLabel.toLowerCase()}`}
      className="group/title w-full flex items-center gap-2 py-0.5 text-left rounded-ns focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ns-accent"
    >
      <span
        className={`truncate ${className} ${
          value ? "" : "text-ns-ink-muted italic"
        }`}
      >
        {value || placeholder}
      </span>
      <Pencil
        aria-hidden="true"
        className={`${iconSize} flex-shrink-0 ml-auto text-ns-ink-muted opacity-0 group-hover/title:opacity-100 group-focus-visible/title:opacity-100 transition-opacity duration-150`}
      />
    </button>
  );
}
