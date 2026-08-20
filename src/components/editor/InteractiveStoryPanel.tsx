import { useEffect, useRef, useState } from "react";
import { Editor } from "@tiptap/react";
import { BookOpen, Loader, RefreshCw, Sparkles, X } from "lucide-react";
import { generateStoryChoices, StoryChoice } from "@/cloudFunctions/ai";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

const MAX_TURNS = 12;

// The agent raises "unexpected structure" / "Expected N choices" when the model
// returns malformed or truncated JSON — technical noise (often including a raw
// JSON dump) that's almost always transient. Surface reassuring copy instead of
// the raw payload; genuine actionable errors (e.g. insufficient credits) pass
// through unchanged. Retrying is always a manual user action (never automatic).
function friendlyChoicesError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : "";
  if (/unexpected structure|Expected \d+ choice|malformed|```/i.test(raw)) {
    return "The AI's response came back garbled. This is usually temporary — please try again.";
  }
  return raw || fallback;
}

interface InteractiveStoryPanelProps {
  storyId: string;
  chapterId?: string;
  editor: Editor;
  mode: "opening" | "continuation";
  turnCount: number;
  onClose: () => void;
  onChoiceInserted: () => void;
}

type Phase = "loading" | "choosing" | "ending-loading" | "error";

export function InteractiveStoryPanel({
  storyId,
  chapterId,
  editor,
  mode,
  turnCount,
  onClose,
  onChoiceInserted,
}: InteractiveStoryPanelProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [openingScene, setOpeningScene] = useState<string | null>(null);
  const [choices, setChoices] = useState<StoryChoice[]>([]);
  const [customDirection, setCustomDirection] = useState("");
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [regenKey, setRegenKey] = useState(0);

  // Track which (turn, regenKey) we've already fetched for so re-renders don't re-fetch
  const fetchedForTurn = useRef("");

  useEffect(() => {
    const fetchKey = `${turnCount}-${regenKey}`;
    if (fetchedForTurn.current === fetchKey) return;
    fetchedForTurn.current = fetchKey;

    setPhase("loading");
    setChoices([]);
    setOpeningScene(null);
    setErrorMessage("");

    const currentMode = turnCount === 0 ? mode : "continuation";

    generateStoryChoices({
      storyId,
      chapterId,
      mode: currentMode,
      currentContent: editor.getHTML(),
      turnCount,
    })
      .then((data) => {
        setOpeningScene(data.openingScene ?? null);
        setChoices(data.choices ?? []);
        setPhase("choosing");
      })
      .catch((err: unknown) => {
        setErrorMessage(
          friendlyChoicesError(err, "Failed to generate story choices."),
        );
        setPhase("error");
      });
  }, [turnCount, regenKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function insertText(text: string) {
    editor.chain().focus().insertContent(text).run();
  }

  function handleChoiceSelect(choice: StoryChoice) {
    const toInsert =
      turnCount === 0 && openingScene
        ? `${openingScene}\n\n${choice.sceneText}`
        : choice.sceneText;
    insertText(toInsert);

    if (choice.isFinal) {
      onClose();
    } else {
      onChoiceInserted();
    }
  }

  async function handleEndStory() {
    setPhase("ending-loading");
    try {
      const data = await generateStoryChoices({
        storyId,
        chapterId,
        mode: "ending",
        currentContent: editor.getHTML(),
        turnCount,
      });
      const endingChoices = data.choices ?? [];
      if (endingChoices.length > 0) {
        insertText(endingChoices[0].sceneText);
      }
      onClose();
    } catch (err: unknown) {
      setErrorMessage(friendlyChoicesError(err, "Failed to generate ending."));
      setPhase("choosing");
    }
  }

  async function handleCustomSubmit() {
    if (!customDirection.trim()) return;
    setIsLoadingCustom(true);
    try {
      const data = await generateStoryChoices({
        storyId,
        chapterId,
        mode: "continuation",
        currentContent: customDirection,
        turnCount,
      });
      const results = data.choices ?? [];
      if (results.length > 0) {
        insertText(results[0].sceneText);
        onChoiceInserted();
      }
    } catch (err: unknown) {
      setErrorMessage(friendlyChoicesError(err, "Failed to generate scene."));
    } finally {
      setIsLoadingCustom(false);
      setCustomDirection("");
    }
  }

  const isNearingEnd = turnCount >= MAX_TURNS - 2;
  const isEndingLoading = phase === "ending-loading";

  return (
    <div
      className="w-full flex flex-col bg-transparent border-0 rounded-none shadow-none overflow-hidden"
      style={{ maxHeight: "30vh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ns-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-ns-accent" />
          <span className="font-heading text-base text-ns-ink">
            {turnCount === 0 ? "Co-write" : "Continue the Story"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {turnCount > 0 && (
            <span className="font-ui text-xs text-ns-ink-muted tracking-wide">
              Turn {turnCount}
            </span>
          )}
          {phase === "choosing" && (
            <button
              onClick={() => setRegenKey((k) => k + 1)}
              className="p-1 rounded text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover transition-colors"
              aria-label="Regenerate choices"
              title="Regenerate choices"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
        {/* Loading state */}
        {(phase === "loading" || phase === "ending-loading") && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-ns-ink-muted">
            <Loader className="w-5 h-5 animate-spin text-ns-accent" />
            <p className="font-ui text-sm">
              {phase === "ending-loading"
                ? "Crafting your ending…"
                : "Generating story directions…"}
            </p>
          </div>
        )}

        {/* Error state — manual retry only (bumping regenKey re-runs the fetch) */}
        {phase === "error" && (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <p className="font-ui text-sm text-ns-destructive">
              {errorMessage}
            </p>
            <button
              onClick={() => setRegenKey((k) => k + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 font-ui text-xs bg-ns-accent text-white rounded-ns hover:bg-ns-accent-hover transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Try again
            </button>
          </div>
        )}

        {/* Choices */}
        {phase === "choosing" && (
          <>
            {/* Opening scene block */}
            {openingScene && (
              <div className="pl-3 border-l-2 border-ns-accent">
                <p className="font-ui text-xs text-ns-ink-muted uppercase tracking-wider mb-1">
                  Opening scene
                </p>
                <p className="font-body text-sm text-ns-ink leading-relaxed whitespace-pre-wrap line-clamp-4">
                  {openingScene}
                </p>
              </div>
            )}

            {/* Nearing-end warning */}
            {isNearingEnd && (
              <p className="font-ui text-xs text-ns-ink-muted italic">
                Story approaching natural length — consider wrapping up.
              </p>
            )}

            {/* Direction choices */}
            <div>
              <p className="font-ui text-xs text-ns-ink-muted uppercase tracking-wider mb-3">
                Where does the story go next?
              </p>
              <div className="space-y-0">
                {choices.map((choice, i) => (
                  <button
                    key={i}
                    onClick={() => handleChoiceSelect(choice)}
                    className="w-full text-left py-3 group flex gap-3 items-start border-b border-ns-border last:border-b-0 hover:bg-ns-surface-hover transition-colors px-1 rounded-sm"
                  >
                    <span className="font-ui text-xs text-ns-accent mt-0.5 w-5 shrink-0 select-none">
                      {ROMAN[i]}
                    </span>
                    <div className="min-w-0">
                      <p className="font-heading text-sm text-ns-ink mb-0.5 leading-snug">
                        {choice.label}
                      </p>
                      <p className="font-body text-sm text-ns-ink-secondary leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                        {choice.sceneText}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom direction */}
            <div className="pt-1 space-y-2">
              <p className="font-ui text-xs text-ns-ink-muted uppercase tracking-wider">
                Write your own direction
              </p>
              <textarea
                className="w-full bg-transparent border-b border-ns-border px-0 py-1.5 text-ns-ink font-body text-sm placeholder:text-ns-ink-muted resize-none focus:outline-none focus:border-ns-accent transition-colors"
                rows={2}
                placeholder="Describe what happens next…"
                value={customDirection}
                onChange={(e) => setCustomDirection(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    void handleCustomSubmit();
                  }
                }}
              />
              {customDirection.trim() && (
                <button
                  onClick={() => void handleCustomSubmit()}
                  disabled={isLoadingCustom}
                  className="flex items-center gap-1.5 px-3 py-1.5 font-ui text-xs bg-ns-accent text-white rounded-ns hover:bg-ns-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingCustom ? (
                    <Loader className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {isLoadingCustom ? "Writing…" : "Continue with this"}
                </button>
              )}
              {errorMessage && phase === "choosing" && (
                <p className="font-ui text-xs text-ns-destructive">
                  {errorMessage}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer — End Story button, only after first turn */}
      {turnCount > 0 && (
        <div className="px-4 py-2.5 border-t border-ns-border shrink-0">
          <button
            onClick={() => void handleEndStory()}
            disabled={isEndingLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 font-ui text-xs text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover rounded-ns transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEndingLoading ? (
              <Loader className="w-3 h-3 animate-spin" />
            ) : (
              <BookOpen className="w-3 h-3" />
            )}
            {isEndingLoading ? "Writing ending…" : "End Story"}
          </button>
        </div>
      )}
    </div>
  );
}
