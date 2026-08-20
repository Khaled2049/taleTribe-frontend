import React, { useRef, useEffect, ChangeEvent, useState } from "react";
import {
  BookOpen,
  Book,
  Trash2,
  FileText,
  Users,
  MapPin,
  Layers,
  Plus,
} from "lucide-react";
import { Chapter } from "@novelsync/story-data-client";

type LocalTab = "chapters" | "plot" | "characters" | "places";

const TABS: {
  id: LocalTab;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { id: "chapters", label: "Chapters", Icon: BookOpen },
  // { id: "plot",       label: "Plot",       Icon: Layers   },
  // { id: "characters", label: "People",     Icon: Users    },
  // { id: "places",     label: "Places",     Icon: MapPin   },
];

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
  activeTab?: "chapters" | "ai";
  onTabChange?: (tab: "chapters" | "ai") => void;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  chapters,
  currentChapterId,
  chapterTitle,
  storyTitle,
  onChapterSelect,
  onChapterDelete,
  onChapterAdd,
  chapterLimit = 50,
  onStoryTitleChange,
  onChapterTitleChange,
  onMetadataChange,
  onTabChange = () => {},
}) => {
  const [localTab, setLocalTab] = useState<LocalTab>("chapters");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void,
  ) => {
    setter(e.target.value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onMetadataChange();
      debounceTimerRef.current = null;
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleTabChange = (tab: LocalTab) => {
    setLocalTab(tab);
    if (tab === "chapters") onTabChange("chapters");
  };

  return (
    <div className="h-full flex flex-col bg-ns-surface">
      {/* ── Metadata Header ── */}
      <div className="px-4 pt-5 pb-4 space-y-3 border-b border-ns-border">
        {/* Story Title */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
            <FileText className="w-3 h-3" />
            Story
          </label>
          <input
            type="text"
            value={storyTitle}
            onChange={(e) => handleInputChange(e, onStoryTitleChange)}
            placeholder="Story title…"
            className="w-full font-ui text-sm font-medium px-3 py-2 bg-ns-elevated border border-ns-border rounded-ns text-ns-ink placeholder:text-ns-ink-muted focus:outline-none focus:ring-1 focus:ring-ns-accent focus:border-ns-accent transition-all duration-150"
            maxLength={80}
          />
        </div>

        {/* Chapter Title */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
            <Book className="w-3 h-3" />
            Chapter
          </label>
          <input
            type="text"
            value={chapterTitle}
            onChange={(e) => handleInputChange(e, onChapterTitleChange)}
            placeholder="Chapter title…"
            className="w-full font-ui text-sm px-3 py-2 bg-ns-elevated border border-ns-border rounded-ns text-ns-ink placeholder:text-ns-ink-muted focus:outline-none focus:ring-1 focus:ring-ns-accent focus:border-ns-accent transition-all duration-150"
            maxLength={80}
          />
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex flex-shrink-0 border-b border-ns-border">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = localTab === id;
          return (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 font-ui text-[10px] font-medium tracking-wide transition-all duration-150 border-b-2 ${
                isActive
                  ? "border-ns-accent text-ns-accent bg-ns-accent-subtle"
                  : "border-transparent text-ns-ink-muted hover:text-ns-ink-secondary hover:bg-ns-surface-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-hidden">
        {/* Chapters list */}
        {localTab === "chapters" && (
          <div className="h-full flex flex-col">
            {/* Chapters header + add button */}
            {onChapterAdd && (
              <div className="flex items-center justify-between flex-shrink-0 px-4 pt-3 pb-2">
                <span className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                  {chapters.length} {chapters.length === 1 ? "Chapter" : "Chapters"}
                </span>
                <button
                  onClick={onChapterAdd}
                  disabled={chapters.length >= chapterLimit}
                  title={
                    chapters.length >= chapterLimit
                      ? `Chapter limit reached (${chapterLimit})`
                      : "Add chapter"
                  }
                  aria-label="Add chapter"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-ns text-ns-ink-muted hover:text-ns-accent hover:bg-ns-accent-subtle active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto pb-3 px-3">
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
              <div className="space-y-0.5">
                {chapters.map((chapter) => {
                  const isActive = currentChapterId === chapter.id;
                  return (
                    <div
                      key={chapter.id}
                      className={`flex items-center rounded-ns transition-all duration-150 group ${
                        isActive
                          ? "bg-ns-accent-subtle"
                          : "hover:bg-ns-surface-hover"
                      }`}
                    >
                      <button
                        onClick={() => onChapterSelect(chapter)}
                        className="flex-1 text-left px-3 py-2.5 min-w-0"
                      >
                        <div className="flex items-start gap-2.5">
                          <Book
                            className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-colors ${
                              isActive ? "text-ns-accent" : "text-ns-ink-muted"
                            }`}
                          />
                          <div className="min-w-0">
                            <p
                              className={`font-ui text-xs font-medium line-clamp-2 transition-colors ${
                                isActive
                                  ? "text-ns-ink"
                                  : "text-ns-ink-secondary"
                              }`}
                            >
                              {chapter.title || "Untitled"}
                            </p>
                            <p className="font-ui text-[10px] text-ns-ink-muted mt-0.5 tabular-nums">
                              {(chapter.wordCount || 0).toLocaleString()} words
                            </p>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChapterDelete(chapter.id);
                        }}
                        className="flex-shrink-0 p-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-ns-ink-muted hover:text-ns-destructive transition-all duration-150"
                        aria-label="Delete chapter"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        )}

        {/* Plot placeholder */}
        {localTab === "plot" && (
          <PlaceholderPane
            icon={<Layers className="w-5 h-5 text-ns-accent opacity-60" />}
            title="Plot Outline"
            subtitle="Map your story arcs and chapter beats"
          />
        )}

        {/* Characters placeholder */}
        {localTab === "characters" && (
          <PlaceholderPane
            icon={<Users className="w-5 h-5 text-ns-accent opacity-60" />}
            title="Characters"
            subtitle="Build and track your cast of characters"
          />
        )}

        {/* Places placeholder */}
        {localTab === "places" && (
          <PlaceholderPane
            icon={<MapPin className="w-5 h-5 text-ns-accent opacity-60" />}
            title="Places"
            subtitle="Document the worlds your story inhabits"
          />
        )}
      </div>
    </div>
  );
};

/* ── Shared placeholder pane ── */
function PlaceholderPane({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 animate-ns-fade-in">
      <div className="w-12 h-12 rounded-full bg-ns-accent-subtle flex items-center justify-center">
        {icon}
      </div>
      <div className="text-center space-y-1.5">
        <p className="font-heading italic text-sm text-ns-ink-secondary">
          {title}
        </p>
        <p className="font-ui text-xs text-ns-ink-muted leading-relaxed">
          {subtitle}
        </p>
        <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-ns-accent-subtle font-ui text-[10px] font-semibold text-ns-accent tracking-wide uppercase">
          Coming soon
        </span>
      </div>
    </div>
  );
}
