// src/components/reader/ChapterReader.tsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight, AlertCircle, RotateCw } from "lucide-react";
import { Chapter, Highlight, RenderMark } from "@/types/IReader";
import { READER_THEMES } from "../../constants/readerThemes";
import { READ_ALOUD_ENABLED } from "@/config/featureFlags";
import { useReadAloud } from "@/hooks/useReadAloud";
import { useReaderSettings } from "../../hooks/useReaderSettings";
import { useWordLookup } from "../../hooks/useWordLookup";
import { useSearch } from "../../hooks/useSearch";
import { useChapterModel } from "../../hooks/useChapterModel";
import { useHighlights } from "../../hooks/useHighLights";
import { useReaderSelection } from "../../hooks/useReaderSelection";
import { useScrollProgress } from "../../hooks/useScrollProgress";
import { ReaderTopBar } from "./ReaderTopBar";
import { ReaderBottomBar } from "./ReaderBottomBar";
import { ReaderContent } from "./ReaderContent";
import { ReaderSettingsPanel } from "./ReaderSettingsPanel";
import { ReadAloudPanel } from "./ReadAloudPanel";
import { ReaderSearchPanel } from "./ReaderSearchPanel";
import { WordDefinitionPopup } from "./WordDefinitionPopup";
import { HighlightMenu } from "./HighlightMenu";
import { HighlightActionMenu } from "./HighlightActionMenu";

interface ChapterReaderProps {
  currentChapter: Chapter;
  currentChapterIndex: number;
  totalChapters: number;
  chapterLoading?: boolean;
  chapterError?: string | null;
  onRetryChapter?: () => void;
  onBackToDetails: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  /** Scroll fraction to restore on entry (only for the resumed chapter). */
  resumeScrollPercent?: number | null;
  /** Persist the current scroll fraction (throttled). */
  onScrollPersist?: (percent: number) => void;
}

const WORDS_PER_MINUTE = 225;

const clampX = (x: number) => Math.min(window.innerWidth - 70, Math.max(70, x));

export const ChapterReader: React.FC<ChapterReaderProps> = ({
  currentChapter,
  currentChapterIndex,
  totalChapters,
  chapterLoading = false,
  chapterError = null,
  onRetryChapter,
  onBackToDetails,
  onPrevChapter,
  onNextChapter,
  resumeScrollPercent = null,
  onScrollPersist,
}) => {
  // Settings
  const { settings, updateSettings } = useReaderSettings();
  const [showSettings, setShowSettings] = useState(false);

  // Parsed-once chapter model (text + offsets), shared by search & highlights.
  const model = useChapterModel(currentChapter.content);

  // Read aloud (client-side Kokoro TTS)
  const [showReadAloud, setShowReadAloud] = useState(false);
  const readAloud = useReadAloud({
    text: model.plainText,
    voice: settings.ttsVoice,
    speed: settings.ttsSpeed,
  });

  // Search
  const {
    searchTerm,
    searchMatches,
    currentResultIndex,
    search,
    clearSearch,
    goToNextResult,
    goToPreviousResult,
    totalResults,
  } = useSearch(model);
  const [showSearch, setShowSearch] = useState(false);
  const activeMarkRef = useRef<HTMLElement | null>(null);

  // Word Lookup
  const {
    definition,
    loading: definitionLoading,
    error: definitionError,
    position: definitionPosition,
    selectedWord,
    lookupWord,
    clearDefinition,
  } = useWordLookup();

  // Highlights (localStorage, per chapter)
  const { highlights, addHighlight, deleteHighlight, updateHighlight } =
    useHighlights(currentChapter.id);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { selection, clear: clearSelection } = useReaderSelection(
    contentRef,
    model.plainText,
  );
  const [activeHighlight, setActiveHighlight] = useState<{
    highlight: Highlight;
    x: number;
    y: number;
  } | null>(null);

  // Scroll progress (live value + save/restore)
  const handlePersist = useCallback(
    (percent: number) => onScrollPersist?.(percent),
    [onScrollPersist],
  );
  const { scrollPercent } = useScrollProgress({
    chapterId: currentChapter.id,
    contentReady: !chapterLoading && !!currentChapter.content,
    savedPercentForChapter: resumeScrollPercent,
    onPersist: handlePersist,
  });

  // Get current theme
  const currentTheme = READER_THEMES[settings.theme];
  const isFirstChapter = currentChapterIndex === 0;
  const isLastChapter = currentChapterIndex === totalChapters - 1;

  // Compose marks: highlights first so search renders visually on top.
  const highlightMarks = useMemo<RenderMark[]>(
    () =>
      highlights.map((h) => ({
        start: h.position.start,
        end: h.position.end,
        kind: "highlight",
        color: h.color,
        id: h.id,
      })),
    [highlights],
  );
  const marks = useMemo<RenderMark[]>(
    () => [...highlightMarks, ...searchMatches],
    [highlightMarks, searchMatches],
  );

  // Estimated reading time left in this chapter.
  const minutesRemaining = useMemo(
    () => Math.ceil((model.wordCount * (1 - scrollPercent)) / WORDS_PER_MINUTE),
    [model.wordCount, scrollPercent],
  );

  // Scroll the active search result into view.
  useEffect(() => {
    if (totalResults > 0) {
      activeMarkRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  }, [currentResultIndex, totalResults]);

  // Keyboard chapter navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowLeft" && !isFirstChapter) onPrevChapter();
      if (e.key === "ArrowRight" && !isLastChapter) onNextChapter();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFirstChapter, isLastChapter, onPrevChapter, onNextChapter]);

  const handleSearchToggle = () => {
    setShowSearch(!showSearch);
    if (showSearch) clearSearch();
  };

  const handleSettingsToggle = () => setShowSettings(!showSettings);

  const handleHighlightClick = useCallback(
    (id: string, x: number, y: number) => {
      const highlight = highlights.find((h) => h.id === id);
      if (highlight) setActiveHighlight({ highlight, x, y });
    },
    [highlights],
  );

  const handlePickColor = useCallback(
    async (color: Highlight["color"]) => {
      if (!selection) return;
      await addHighlight(selection.text, color, {
        start: selection.start,
        end: selection.end,
      });
      clearSelection();
      window.getSelection()?.removeAllRanges();
    },
    [selection, addHighlight, clearSelection],
  );

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${currentTheme.bg} ${currentTheme.text}`}
    >
      {/* Top Navigation Bar */}
      <ReaderTopBar
        theme={currentTheme}
        onBack={onBackToDetails}
        onSearchToggle={handleSearchToggle}
        onSettingsToggle={handleSettingsToggle}
        onReadAloudToggle={
          READ_ALOUD_ENABLED
            ? () => setShowReadAloud(!showReadAloud)
            : undefined
        }
        readAloudActive={
          readAloud.status !== "idle" && readAloud.status !== "error"
        }
      />

      {/* Read Aloud Panel */}
      {READ_ALOUD_ENABLED && showReadAloud && (
        <ReadAloudPanel
          status={readAloud.status}
          voices={readAloud.voices}
          voice={settings.ttsVoice}
          speed={settings.ttsSpeed}
          onVoiceChange={(ttsVoice) => updateSettings({ ttsVoice })}
          onSpeedChange={(ttsSpeed) => updateSettings({ ttsSpeed })}
          onPlayPause={() => {
            if (readAloud.status === "playing") {
              readAloud.pause();
            } else {
              void readAloud.play();
            }
          }}
          onStop={readAloud.stop}
          onClose={() => setShowReadAloud(false)}
        />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <ReaderSettingsPanel
          settings={settings}
          onUpdateSettings={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Search Panel */}
      {showSearch && (
        <ReaderSearchPanel
          searchTerm={searchTerm}
          totalResults={totalResults}
          currentResultIndex={currentResultIndex}
          onSearchChange={search}
          onClose={() => {
            setShowSearch(false);
            clearSearch();
          }}
          onNextResult={goToNextResult}
          onPrevResult={goToPreviousResult}
        />
      )}

      {/* Word Definition Popup */}
      {selectedWord && (
        <WordDefinitionPopup
          word={selectedWord}
          definition={definition}
          loading={definitionLoading}
          error={definitionError}
          position={definitionPosition}
          onClose={clearDefinition}
        />
      )}

      {/* Highlight colour menu (text selected) — takes precedence over actions */}
      {selection && !activeHighlight && (
        <HighlightMenu
          position={{
            x: clampX(selection.rect.left + selection.rect.width / 2),
            y: selection.rect.top - 10,
          }}
          onSelectColor={handlePickColor}
        />
      )}

      {/* Highlight action menu (existing highlight tapped) */}
      {activeHighlight && (
        <HighlightActionMenu
          position={{ x: clampX(activeHighlight.x), y: activeHighlight.y }}
          highlight={activeHighlight.highlight}
          onDelete={() => {
            deleteHighlight(activeHighlight.highlight.id);
            setActiveHighlight(null);
          }}
          onSaveNote={(note) => {
            updateHighlight(activeHighlight.highlight.id, { note });
            setActiveHighlight(null);
          }}
          onClose={() => setActiveHighlight(null)}
        />
      )}

      {/* Side Navigation Zones */}
      {!isFirstChapter && (
        <button
          onClick={onPrevChapter}
          className="fixed left-0 top-0 bottom-0 w-16 z-30 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 transition-opacity duration-200 group"
          aria-label="Previous chapter"
        >
          <div
            className={`p-2 rounded-full ${currentTheme.bg} ${currentTheme.text} shadow-lg border ${currentTheme.border}`}
          >
            <ChevronLeft size={24} />
          </div>
        </button>
      )}
      {!isLastChapter && (
        <button
          onClick={onNextChapter}
          className="fixed right-0 top-0 bottom-0 w-16 z-30 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity duration-200 group"
          aria-label="Next chapter"
        >
          <div
            className={`p-2 rounded-full ${currentTheme.bg} ${currentTheme.text} shadow-lg border ${currentTheme.border}`}
          >
            <ChevronRight size={24} />
          </div>
        </button>
      )}

      {/* Chapter loading overlay */}
      {chapterLoading && (
        <div
          className={`fixed inset-0 z-40 flex items-center justify-center ${currentTheme.bg}`}
          style={{ opacity: 0.85 }}
          role="status"
          aria-live="polite"
          aria-label="Loading chapter"
        >
          <svg
            className="w-8 h-8 animate-spin"
            style={{ opacity: 0.5 }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              className="opacity-25"
            />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              className="opacity-75"
            />
          </svg>
        </div>
      )}

      {/* Chapter error overlay — replaces the infinite spinner on failure */}
      {chapterError && !chapterLoading && (
        <div
          className={`fixed inset-0 z-40 flex items-center justify-center px-6 ${currentTheme.bg}`}
        >
          <div
            className={`flex flex-col items-center gap-4 text-center max-w-sm ${currentTheme.text}`}
          >
            <AlertCircle size={36} className="opacity-70" />
            <p className="text-base font-medium">{chapterError}</p>
            {onRetryChapter && (
              <button
                onClick={onRetryChapter}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${currentTheme.border} ${currentTheme.hover} transition-colors`}
              >
                <RotateCw size={16} />
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Reading Content */}
      <ReaderContent
        title={currentChapter.title}
        model={model}
        marks={marks}
        activeMarkRef={activeMarkRef}
        containerRef={contentRef}
        fontSize={settings.fontSize}
        fontFamily={settings.fontFamily}
        lineHeight={settings.lineHeight}
        textAlign={settings.textAlign}
        onWordClick={lookupWord}
        onHighlightClick={handleHighlightClick}
      />

      {/* The End */}
      {isLastChapter && (
        <div
          className="flex flex-col items-center gap-3 py-16 pb-32"
          style={{ opacity: 0.6 }}
        >
          <div className="flex items-center gap-4 w-48">
            <div className="flex-1 h-px bg-current" style={{ opacity: 0.3 }} />
            <span className="text-xs select-none">✦</span>
            <div className="flex-1 h-px bg-current" style={{ opacity: 0.3 }} />
          </div>
          <p className={`font-heading italic text-3xl ${currentTheme.text}`}>
            The End
          </p>
        </div>
      )}

      {/* Bottom Navigation */}
      <ReaderBottomBar
        theme={currentTheme}
        currentChapterIndex={currentChapterIndex}
        totalChapters={totalChapters}
        scrollPercent={scrollPercent}
        minutesRemaining={minutesRemaining}
        onPrevChapter={onPrevChapter}
        onNextChapter={onNextChapter}
      />
    </div>
  );
};
