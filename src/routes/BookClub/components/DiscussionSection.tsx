import React, { useState } from "react";
import { Send } from "lucide-react";
import { IClub, IPromptResponse } from "@/types/IClub";
import { bookClubRepo } from "../bookClubRepo";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RATE_LIMITS } from "@/config/rateLimits";

interface DiscussionSectionProps {
  club: IClub;
  isCreator: boolean;
  userCurrentChapter?: number;
}

/**
 * Chapter-anchored discussion threads. Threads past the reader's current
 * chapter are blurred client-side (click to reveal) — nothing is locked and
 * nothing is written to Firestore to reveal a thread.
 */
const DiscussionSection: React.FC<DiscussionSectionProps> = ({
  club,
  isCreator,
  userCurrentChapter = 0,
}) => {
  const { user } = useAuthContext();
  const prompts = club.discussionPrompts || [];

  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [composerFor, setComposerFor] = useState<string | null>(null);
  const [newResponse, setNewResponse] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticResponses, setOptimisticResponses] = useState<
    Record<string, IPromptResponse[]>
  >({});

  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newPrompt, setNewPrompt] = useState({
    chapterNumber: 1,
    question: "",
    description: "",
  });

  const reveal = (promptId: string) =>
    setRevealed((prev) => new Set(prev).add(promptId));

  const toggleExpanded = (promptId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(promptId)) {
        next.delete(promptId);
      } else {
        next.add(promptId);
      }
      return next;
    });

  const handleCreatePrompt = async () => {
    setCreateError(null);

    if (!newPrompt.question.trim()) {
      setCreateError("Please enter a question");
      return;
    }

    if (newPrompt.question.length > RATE_LIMITS.MAX_PROMPT_QUESTION_LENGTH) {
      setCreateError(
        `Question is too long. Maximum ${RATE_LIMITS.MAX_PROMPT_QUESTION_LENGTH} characters allowed.`,
      );
      return;
    }

    if (
      newPrompt.description.length > RATE_LIMITS.MAX_PROMPT_DESCRIPTION_LENGTH
    ) {
      setCreateError(
        `Description is too long. Maximum ${RATE_LIMITS.MAX_PROMPT_DESCRIPTION_LENGTH} characters allowed.`,
      );
      return;
    }

    setIsSaving(true);
    try {
      await bookClubRepo.createDiscussionPrompt(club.id, {
        chapterNumber: newPrompt.chapterNumber,
        question: newPrompt.question.trim(),
        description: newPrompt.description.trim(),
        createdAt: new Date().toISOString(),
        creatorId: user!.uid,
        responses: [],
      });

      setIsCreatingPrompt(false);
      setNewPrompt({ chapterNumber: 1, question: "", description: "" });
    } catch (err) {
      console.error("Error creating prompt:", err);
      setCreateError(
        err instanceof Error ? err.message : "Failed to create prompt",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddResponse = async (promptId: string) => {
    if (!newResponse.trim() || !user) return;

    setError(null);

    if (newResponse.length > RATE_LIMITS.MAX_PROMPT_RESPONSE_LENGTH) {
      setError(
        `Response is too long. Maximum ${RATE_LIMITS.MAX_PROMPT_RESPONSE_LENGTH} characters allowed.`,
      );
      return;
    }

    const tempResponse: IPromptResponse = {
      id: `temp-${Date.now()}`,
      userId: user.uid,
      username: user.username || "Anonymous",
      content: newResponse,
      createdAt: new Date().toISOString(),
    };

    setOptimisticResponses((prev) => ({
      ...prev,
      [promptId]: [...(prev[promptId] || []), tempResponse],
    }));

    setIsSaving(true);
    try {
      await bookClubRepo.addPromptResponse(club.id, promptId, {
        userId: user.uid,
        username: user.username,
        content: newResponse.trim(),
        createdAt: new Date().toISOString(),
      });

      setNewResponse("");
      setComposerFor(null);
      setOptimisticResponses((prev) => {
        const next = { ...prev };
        delete next[promptId];
        return next;
      });
    } catch (err) {
      console.error("Error adding response:", err);
      setError(err instanceof Error ? err.message : "Failed to add response");
      setOptimisticResponses((prev) => {
        const next = { ...prev };
        if (next[promptId]) {
          next[promptId] = next[promptId].filter(
            (r) => r.id !== tempResponse.id,
          );
          if (next[promptId].length === 0) delete next[promptId];
        }
        return next;
      });
    } finally {
      setIsSaving(false);
    }
  };

  const sortedPrompts = [...prompts].sort(
    (a, b) => a.chapterNumber - b.chapterNumber,
  );

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <p className="font-body text-sm italic text-ns-ink-muted">
          {sortedPrompts.length === 0
            ? isCreator
              ? "No discussion threads yet — start one for a chapter."
              : "No discussion threads yet."
            : `${sortedPrompts.length} thread${sortedPrompts.length !== 1 ? "s" : ""}, anchored by chapter.`}
        </p>
        {isCreator && (
          <button
            type="button"
            onClick={() => setIsCreatingPrompt(true)}
            className="font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-ns-ink-muted hover:text-ns-accent transition-colors shrink-0"
          >
            New thread →
          </button>
        )}
      </div>

      <div>
        {sortedPrompts.map((prompt) => {
          const responses = [
            ...(prompt.responses || []),
            ...(optimisticResponses[prompt.id] || []),
          ];
          const isSpoiler =
            prompt.chapterNumber > userCurrentChapter &&
            !revealed.has(prompt.id);
          const isExpanded = expanded.has(prompt.id);
          const visibleResponses = isExpanded
            ? responses
            : responses.slice(0, 3);
          const showComposer = composerFor === prompt.id;

          return (
            <div
              key={prompt.id}
              className="relative border-t border-ns-border py-6 first:border-t-0 first:pt-0"
            >
              <div
                className={
                  isSpoiler ? "blur-sm select-none pointer-events-none" : ""
                }
                aria-hidden={isSpoiler}
              >
                <span className="inline-block font-ui text-[10px] uppercase tracking-widest text-ns-ink-muted border border-ns-border rounded-full px-2 py-0.5 mb-2">
                  Ch. {prompt.chapterNumber}
                </span>
                <h3 className="font-heading text-xl text-ns-ink leading-snug">
                  {prompt.question}
                </h3>
                {prompt.description && (
                  <p className="font-body text-sm text-ns-ink-secondary mt-1.5 max-w-2xl">
                    {prompt.description}
                  </p>
                )}

                {responses.length > 0 && (
                  <div className="mt-4 space-y-3 border-l border-ns-border pl-4">
                    {visibleResponses.map((response) => (
                      <div key={response.id}>
                        <p className="font-ui text-xs font-semibold text-ns-ink">
                          {response.username || "Anonymous"}
                        </p>
                        <p className="font-body text-sm text-ns-ink-secondary whitespace-pre-wrap">
                          {response.content}
                        </p>
                      </div>
                    ))}
                    {responses.length > 3 && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(prompt.id)}
                        className="font-ui text-xs text-ns-accent hover:opacity-80 transition-opacity"
                      >
                        {isExpanded
                          ? "Show fewer"
                          : `View all ${responses.length} responses`}
                      </button>
                    )}
                  </div>
                )}

                {user && (
                  <div className="mt-4">
                    {showComposer ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <Textarea
                            value={newResponse}
                            onChange={(e) => {
                              setNewResponse(e.target.value);
                              setError(null);
                            }}
                            maxLength={RATE_LIMITS.MAX_PROMPT_RESPONSE_LENGTH}
                            className="min-h-[80px]"
                            placeholder="Share your thoughts…"
                            autoFocus
                          />
                          <span className="absolute right-2 bottom-2 font-ui text-xs text-ns-ink-muted">
                            {newResponse.length}/
                            {RATE_LIMITS.MAX_PROMPT_RESPONSE_LENGTH}
                          </span>
                        </div>
                        {error && (
                          <p
                            className="font-ui text-sm text-ns-accent"
                            role="alert"
                          >
                            {error}
                          </p>
                        )}
                        <div className="flex gap-3 items-center">
                          <Button
                            size="sm"
                            onClick={() => handleAddResponse(prompt.id)}
                            disabled={isSaving || !newResponse.trim()}
                          >
                            <Send size={13} className="mr-1.5" />
                            {isSaving ? "Posting…" : "Post"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerFor(null);
                              setNewResponse("");
                              setError(null);
                            }}
                            className="font-ui text-xs text-ns-ink-muted hover:text-ns-ink transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setComposerFor(prompt.id);
                          setNewResponse("");
                          setError(null);
                        }}
                        className="font-ui text-xs text-ns-ink-muted hover:text-ns-accent transition-colors"
                      >
                        {responses.length === 0
                          ? "Be the first to respond →"
                          : "Add a response →"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isSpoiler && (
                <button
                  type="button"
                  onClick={() => reveal(prompt.id)}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-ns-ink-secondary bg-ns-bg/80 border border-ns-border rounded-full px-4 py-1.5 hover:text-ns-accent hover:border-ns-accent transition-colors">
                    Chapter {prompt.chapterNumber} · spoilers ahead — click to
                    reveal
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* new thread dialog */}
      <Dialog open={isCreatingPrompt} onOpenChange={setIsCreatingPrompt}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-ns-ink">
              Start a discussion thread
            </DialogTitle>
            <DialogDescription>
              Anchor it to a chapter — readers who haven't reached it yet will
              see it blurred, not hidden.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {createError && (
              <p className="font-ui text-sm text-ns-accent" role="alert">
                {createError}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="thread-chapter">Chapter</Label>
              <Input
                id="thread-chapter"
                type="number"
                min="1"
                value={newPrompt.chapterNumber}
                onChange={(e) =>
                  setNewPrompt({
                    ...newPrompt,
                    chapterNumber: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thread-question">Question *</Label>
              <div className="relative">
                <Input
                  id="thread-question"
                  value={newPrompt.question}
                  onChange={(e) => {
                    setNewPrompt({ ...newPrompt, question: e.target.value });
                    setCreateError(null);
                  }}
                  maxLength={RATE_LIMITS.MAX_PROMPT_QUESTION_LENGTH}
                  placeholder="What should the club talk about?"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 font-ui text-xs text-ns-ink-muted">
                  {newPrompt.question.length}/
                  {RATE_LIMITS.MAX_PROMPT_QUESTION_LENGTH}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="thread-description">Context (optional)</Label>
              <div className="relative">
                <Textarea
                  id="thread-description"
                  value={newPrompt.description}
                  onChange={(e) => {
                    setNewPrompt({ ...newPrompt, description: e.target.value });
                    setCreateError(null);
                  }}
                  maxLength={RATE_LIMITS.MAX_PROMPT_DESCRIPTION_LENGTH}
                  className="min-h-[90px]"
                  placeholder="Add context or details…"
                />
                <span className="absolute right-2 bottom-2 font-ui text-xs text-ns-ink-muted">
                  {newPrompt.description.length}/
                  {RATE_LIMITS.MAX_PROMPT_DESCRIPTION_LENGTH}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreatingPrompt(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePrompt}
              disabled={
                isSaving ||
                !newPrompt.question.trim() ||
                newPrompt.question.length >
                  RATE_LIMITS.MAX_PROMPT_QUESTION_LENGTH ||
                newPrompt.description.length >
                  RATE_LIMITS.MAX_PROMPT_DESCRIPTION_LENGTH
              }
            >
              {isSaving ? "Creating…" : "Start thread"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiscussionSection;
