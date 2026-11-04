import {
  type ComponentProps,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  StoryDataConflictError,
  storyVoiceRepo,
  storyWorkspaceRepo,
  type StoryVoiceChange,
  type StoryVoiceInput,
  type StoryVoiceNote,
  type StoryPointOfView,
  type StoryTense,
} from "@novelsync/story-data-client";

const pointOfViewOptions: { value: StoryPointOfView; label: string }[] = [
  { value: "unspecified", label: "Let each scene decide" },
  { value: "first", label: "First person" },
  { value: "close_third", label: "Close third person" },
  { value: "omniscient", label: "Omniscient third person" },
  { value: "varies", label: "Varies by chapter" },
];
const tenseOptions: { value: StoryTense; label: string }[] = [
  { value: "unspecified", label: "Let each scene decide" },
  { value: "past", label: "Past" },
  { value: "present", label: "Present" },
  { value: "varies", label: "Varies by chapter" },
];
const empty: StoryVoiceInput = {
  pointOfView: "unspecified",
  tense: "unspecified",
  notes: [],
  learnFromWriting: true,
  references: [],
};
const field =
  "w-full rounded-ns border border-ns-border bg-ns-surface px-3 py-2 font-body text-sm text-ns-ink focus:outline-none focus:border-ns-accent disabled:opacity-60";

// The browser's own arrow sits flush against the right edge, so draw it inset.
function VoiceSelect({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <span className={`relative block ${className}`}>
      <select
        {...props}
        className={`${field} appearance-none pr-9 dark:[color-scheme:dark]`}
      />
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ns-ink-muted"
      />
    </span>
  );
}

function copyInput(value: StoryVoiceInput): StoryVoiceInput {
  return {
    pointOfView: value.pointOfView,
    tense: value.tense,
    notes: value.notes.map((note) => ({ ...note })),
    learnFromWriting: value.learnFromWriting,
    references: value.references.map((ref) => ({ ...ref })),
  };
}

function pointOfViewLabel(value: StoryPointOfView): string {
  return (
    pointOfViewOptions.find((option) => option.value === value)?.label ?? value
  );
}

function tenseLabel(value: StoryTense): string {
  return tenseOptions.find((option) => option.value === value)?.label ?? value;
}

function changeSummary(change: StoryVoiceChange): string {
  if (change.action === "undo") return "Restored the previous voice";
  if (change.action === "agent") return "Voice updated by assistant";
  const before = new Map(change.before.notes.map((note) => [note.id, note]));
  const after = new Map(change.after.notes.map((note) => [note.id, note]));
  const added = change.after.notes.filter(
    (note) => !before.has(note.id),
  ).length;
  const removed = change.before.notes.filter(
    (note) => !after.has(note.id),
  ).length;
  const edited = change.after.notes.filter((note) => {
    const old = before.get(note.id);
    return old && (old.text !== note.text || old.pinned !== note.pinned);
  }).length;
  const parts = [
    added ? `${added} note${added === 1 ? "" : "s"} added` : "",
    edited ? `${edited} note${edited === 1 ? "" : "s"} changed` : "",
    removed ? `${removed} note${removed === 1 ? "" : "s"} removed` : "",
  ].filter(Boolean);
  if (
    change.before.pointOfView !== change.after.pointOfView ||
    change.before.tense !== change.after.tense
  ) {
    parts.push("narration changed");
  }
  return parts.join(", ") || "Voice saved";
}

export default function StoryVoice() {
  const { storyId } = useParams<{ storyId: string }>();
  const [searchParams] = useSearchParams();
  const requestedChapter = searchParams.get("chapterId");
  const queryClient = useQueryClient();
  const profileKey = ["story-voice", storyId];
  const historyKey = ["story-voice-history", storyId];
  const profile = useQuery({
    queryKey: profileKey,
    queryFn: ({ signal }) => storyVoiceRepo.get(storyId!, signal),
    enabled: Boolean(storyId),
    staleTime: Infinity,
  });
  const history = useQuery({
    queryKey: historyKey,
    queryFn: ({ signal }) => storyVoiceRepo.history(storyId!, signal),
    enabled: Boolean(storyId),
    staleTime: Infinity,
  });
  const chapters = useQuery({
    queryKey: ["voice-chapters", storyId],
    queryFn: () => storyWorkspaceRepo.getChapterIndex(storyId!),
    enabled: Boolean(storyId),
  });
  const [selectedChapter, setSelectedChapter] = useState("");
  const [sourceStart, setSourceStart] = useState(0);
  const [autoReferenceAdded, setAutoReferenceAdded] = useState<string | null>(
    null,
  );
  const source = useQuery({
    queryKey: ["voice-source", storyId, selectedChapter],
    queryFn: () => storyWorkspaceRepo.getChapter(storyId!, selectedChapter),
    enabled: Boolean(storyId && selectedChapter),
  });
  const sourceChars = useMemo(
    () => Array.from(source.data?.content ?? ""),
    [source.data?.content],
  );
  const [draft, setDraft] = useState<StoryVoiceInput>(empty);
  const baselineRef = useRef<StoryVoiceInput | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (requestedChapter) setSelectedChapter(requestedChapter);
  }, [requestedChapter]);

  useEffect(() => {
    const currentKey =
      profile.data && `${profile.data.storyId}:${profile.data.revision}`;
    if (profile.data && currentKey !== loadedKey) {
      if (
        baselineRef.current &&
        JSON.stringify(draft) !== JSON.stringify(baselineRef.current)
      ) {
        setConflict(true);
        return;
      }
      const next = copyInput(profile.data);
      baselineRef.current = next;
      setDraft(next);
      setLoadedKey(currentKey ?? null);
    }
  }, [profile.data, loadedKey, draft]);

  const save = useMutation({
    mutationFn: () =>
      storyVoiceRepo.save(storyId!, profile.data!.revision, draft),
    onSuccess: (saved) => {
      setConflict(false);
      baselineRef.current = copyInput(saved);
      setDraft(copyInput(saved));
      setLoadedKey(`${saved.storyId}:${saved.revision}`);
      queryClient.setQueryData(profileKey, saved);
      void queryClient.invalidateQueries({ queryKey: historyKey });
      toast.success("Voice saved");
    },
    onError: (error) => {
      if (error instanceof StoryDataConflictError) {
        setConflict(true);
        toast.error(
          "This voice changed elsewhere. Load the latest version before saving.",
        );
      } else {
        toast.error(
          error instanceof Error ? error.message : "Could not save voice",
        );
      }
    },
  });
  const undo = useMutation({
    mutationFn: (change: StoryVoiceChange) =>
      storyVoiceRepo.undo(storyId!, profile.data!.revision, change.id),
    onSuccess: (restored) => {
      setConflict(false);
      baselineRef.current = copyInput(restored);
      setDraft(copyInput(restored));
      setLoadedKey(`${restored.storyId}:${restored.revision}`);
      queryClient.setQueryData(profileKey, restored);
      void queryClient.invalidateQueries({ queryKey: historyKey });
      toast.success("Voice change undone");
    },
    onError: (error) => {
      if (error instanceof StoryDataConflictError) setConflict(true);
      toast.error(
        error instanceof Error ? error.message : "Could not undo voice change",
      );
    },
  });

  const changed =
    Boolean(profile.data) &&
    JSON.stringify(draft) !== JSON.stringify(copyInput(profile.data!));
  const totalChars = draft.notes.reduce(
    (sum, note) => sum + note.text.trim().length,
    0,
  );
  const invalidNote = draft.notes.some((note) => !note.text.trim());
  const overLimit = totalChars > 4000;
  const busy = save.isPending || undo.isPending;
  const addReference = () => {
    if (
      !source.data ||
      !source.data.revision ||
      (draft.references.length >= 3 &&
        !draft.references.some((ref) => ref.chapterId === source.data?.id))
    )
      return;
    const content = source.data.content;
    if (!content.trim()) return;
    setDraft((current) => ({
      ...current,
      references: [
        ...current.references.filter(
          (ref) => ref.chapterId !== source.data!.id,
        ),
        {
          chapterId: source.data!.id,
          sourceRevision: source.data!.revision!,
          start: sourceStart,
          end: Math.min(sourceChars.length, sourceStart + 1600),
        },
      ],
    }));
  };

  useEffect(() => {
    if (
      !requestedChapter ||
      autoReferenceAdded === requestedChapter ||
      !loadedKey ||
      source.data?.id !== requestedChapter ||
      !source.data.content ||
      !source.data.revision
    )
      return;
    setAutoReferenceAdded(requestedChapter);
    setDraft((current) =>
      current.references.length >= 3 ||
      current.references.some((ref) => ref.chapterId === requestedChapter)
        ? current
        : {
            ...current,
            references: [
              ...current.references,
              {
                chapterId: requestedChapter,
                sourceRevision: source.data!.revision!,
                start: 0,
                end: Math.min(sourceChars.length, 1600),
              },
            ],
          },
    );
  }, [
    autoReferenceAdded,
    loadedKey,
    requestedChapter,
    source.data,
    sourceChars.length,
  ]);

  const updateNote = (id: string, patch: Partial<StoryVoiceNote>) => {
    setDraft((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === id ? { ...note, ...patch } : note,
      ),
    }));
  };

  return (
    <div className="h-full overflow-y-auto bg-ns-bg px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="border-b border-ns-border pb-6">
          <h1 className="font-body text-3xl text-ns-ink">
            The voice of this story
          </h1>
          <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-ns-ink-secondary">
            Give the writing assistant a few things to remember about this
            story’s prose. Directions for a scene still take priority. Changes
            stay private to this story.
          </p>
        </header>

        {profile.isPending && (
          <p className="text-sm text-ns-ink-secondary">
            Loading this story’s voice…
          </p>
        )}
        {profile.isError && (
          <div role="alert" className="space-y-3 text-sm text-ns-ink">
            <p>Could not load this story’s voice.</p>
            <button
              type="button"
              onClick={() => void profile.refetch()}
              className="text-ns-accent underline"
            >
              Try again
            </button>
          </div>
        )}
        {profile.data && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!invalidNote && !overLimit) save.mutate();
            }}
            className="space-y-8"
          >
            {conflict && (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 border-l-2 border-ns-accent pl-4 text-sm text-ns-ink"
              >
                <span>This voice changed in another tab.</span>
                <button
                  type="button"
                  onClick={() => {
                    baselineRef.current = null;
                    setLoadedKey(null);
                    setConflict(false);
                    void profile.refetch();
                    void history.refetch();
                  }}
                  className="text-ns-accent underline"
                >
                  Load latest voice
                </button>
              </div>
            )}
            <fieldset disabled={busy} className="space-y-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block space-y-2 font-ui text-sm text-ns-ink">
                  <span>Point of view</span>
                  <VoiceSelect
                    value={draft.pointOfView}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        pointOfView: event.target.value as StoryPointOfView,
                      })
                    }
                  >
                    {pointOfViewOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </VoiceSelect>
                </label>
                <label className="block space-y-2 font-ui text-sm text-ns-ink">
                  <span>Tense</span>
                  <VoiceSelect
                    value={draft.tense}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        tense: event.target.value as StoryTense,
                      })
                    }
                  >
                    {tenseOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </VoiceSelect>
                </label>
              </div>

              <section
                aria-labelledby="voice-notes-heading"
                className="space-y-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <h2
                      id="voice-notes-heading"
                      className="font-body text-xl text-ns-ink"
                    >
                      Voice notes
                    </h2>
                    <p className="mt-1 text-sm text-ns-ink-secondary">
                      Write one preference per note. Pinned notes are reserved
                      for your firm rules.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={draft.notes.length >= 12}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        notes: [
                          ...current.notes,
                          {
                            id: crypto.randomUUID(),
                            text: "",
                            origin: "writer",
                            pinned: false,
                          },
                        ],
                      }))
                    }
                    className="font-ui text-sm font-medium text-ns-accent underline disabled:opacity-50"
                  >
                    Add note
                  </button>
                </div>
                {draft.notes.length === 0 && (
                  <p className="rounded-ns border border-dashed border-ns-border px-4 py-6 font-body text-sm text-ns-ink-secondary">
                    No voice notes yet. Add a preference the assistant should
                    remember for this story.
                  </p>
                )}
                <div className="space-y-4">
                  {draft.notes.map((note, index) => (
                    <div
                      key={note.id}
                      className="rounded-ns border border-ns-border bg-ns-surface p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor={`voice-note-${note.id}`}
                          className="font-ui text-sm font-medium text-ns-ink"
                        >
                          Note {index + 1}
                        </label>
                        <div className="flex items-center gap-4 font-ui text-xs">
                          {note.origin === "agent" && (
                            <span className="text-ns-ink-muted">
                              Learned by assistant
                            </span>
                          )}
                          <button
                            type="button"
                            aria-pressed={note.pinned}
                            onClick={() =>
                              updateNote(note.id, { pinned: !note.pinned })
                            }
                            className="text-ns-accent underline"
                          >
                            {note.pinned ? "Unpin" : "Pin"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                notes: current.notes.filter(
                                  (item) => item.id !== note.id,
                                ),
                              }))
                            }
                            className="text-ns-ink-secondary underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <textarea
                        id={`voice-note-${note.id}`}
                        className={`${field} min-h-24 resize-y leading-relaxed`}
                        maxLength={2000}
                        value={note.text}
                        onChange={(event) =>
                          updateNote(note.id, { text: event.target.value })
                        }
                        placeholder="For example: Let unease show through small physical details."
                      />
                    </div>
                  ))}
                </div>
                {invalidNote && (
                  <p role="alert" className="text-sm text-ns-accent">
                    Fill in or remove each empty note before saving.
                  </p>
                )}
                {overLimit && (
                  <p role="alert" className="text-sm text-ns-accent">
                    Keep all notes under 4,000 characters combined.
                  </p>
                )}
              </section>

              <section
                className="space-y-4 border-t border-ns-border pt-6"
                aria-labelledby="voice-references-heading"
              >
                <h2
                  id="voice-references-heading"
                  className="font-body text-xl text-ns-ink"
                >
                  Reference passages
                </h2>
                <p className="text-sm text-ns-ink-secondary">
                  Choose up to three chapters. The assistant uses a short
                  passage only while that chapter stays at the saved revision.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <VoiceSelect
                    aria-label="Chapter for reference"
                    className="w-full max-w-sm"
                    value={selectedChapter}
                    onChange={(event) => {
                      setSelectedChapter(event.target.value);
                      setSourceStart(0);
                    }}
                  >
                    <option value="">Choose a chapter</option>
                    {chapters.data?.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </option>
                    ))}
                  </VoiceSelect>
                  <button
                    type="button"
                    disabled={
                      !source.data?.content ||
                      (draft.references.length >= 3 &&
                        !draft.references.some(
                          (ref) => ref.chapterId === selectedChapter,
                        ))
                    }
                    onClick={addReference}
                    className="font-ui text-sm text-ns-accent underline disabled:opacity-50"
                  >
                    Use this passage
                  </button>
                </div>
                {source.data && (
                  <div className="space-y-2">
                    <label
                      className="block text-xs text-ns-ink-secondary"
                      htmlFor="voice-reference-position"
                    >
                      Choose where the passage begins
                    </label>
                    <input
                      id="voice-reference-position"
                      type="range"
                      min={0}
                      max={Math.max(0, sourceChars.length - 1600)}
                      value={Math.min(
                        sourceStart,
                        Math.max(0, sourceChars.length - 1600),
                      )}
                      onChange={(event) =>
                        setSourceStart(Number(event.target.value))
                      }
                      className="w-full accent-ns-accent"
                    />
                    <p className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-ns border border-ns-border p-3 text-xs text-ns-ink-secondary">
                      {sourceChars
                        .slice(sourceStart, sourceStart + 1600)
                        .join("")
                        .replace(/<[^>]*>/g, " ")}
                    </p>
                  </div>
                )}
                {draft.references.map((ref) => {
                  const chapter = chapters.data?.find(
                    (item) => item.id === ref.chapterId,
                  );
                  return (
                    <div
                      key={ref.chapterId}
                      className="flex items-center justify-between gap-3 rounded-ns border border-ns-border px-4 py-3 text-sm"
                    >
                      <span>
                        {chapter?.title ?? "Deleted chapter"} · revision{" "}
                        {ref.sourceRevision}
                        {chapter && chapter.revision !== ref.sourceRevision
                          ? " · needs replacement"
                          : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            references: current.references.filter(
                              (item) => item.chapterId !== ref.chapterId,
                            ),
                          }))
                        }
                        className="text-ns-accent underline"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </section>

              <label className="flex items-start gap-3 border-t border-ns-border pt-6 font-ui text-sm text-ns-ink">
                <input
                  type="checkbox"
                  checked={draft.learnFromWriting}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      learnFromWriting: event.target.checked,
                    })
                  }
                  className="mt-1"
                />
                <span>
                  <strong className="font-medium">Learn from my writing</strong>
                  <span className="mt-1 block text-ns-ink-secondary">
                    The assistant may update its own voice notes after repeated
                    patterns in saved chapters. You can undo updates here.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3 border-t border-ns-border pt-5">
                <button
                  type="submit"
                  disabled={!changed || invalidNote || overLimit || conflict}
                  className="rounded-ns bg-ns-accent px-5 py-2 font-ui text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save voice
                </button>
                {changed && (
                  <button
                    type="button"
                    onClick={() => setDraft(copyInput(profile.data!))}
                    className="font-ui text-sm text-ns-ink-secondary underline"
                  >
                    Discard changes
                  </button>
                )}
              </div>
            </fieldset>
          </form>
        )}

        {profile.data && (
          <section
            aria-labelledby="voice-history-heading"
            className="border-t border-ns-border pt-7"
          >
            <h2
              id="voice-history-heading"
              className="font-body text-xl text-ns-ink"
            >
              Recent changes
            </h2>
            {history.isPending && (
              <p className="mt-3 text-sm text-ns-ink-secondary">
                Loading changes…
              </p>
            )}
            {history.isError && (
              <button
                type="button"
                onClick={() => void history.refetch()}
                className="mt-3 text-sm text-ns-accent underline"
              >
                Could not load changes. Try again
              </button>
            )}
            {history.data?.length === 0 && (
              <p className="mt-3 text-sm text-ns-ink-secondary">
                Changes will appear here after you save this voice.
              </p>
            )}
            <ol className="mt-4 space-y-3">
              {history.data?.map((change, index) => (
                <li
                  key={change.id}
                  className="border-b border-ns-border pb-3 font-ui text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-ns-ink">{changeSummary(change)}</p>
                      {change.reason && (
                        <p className="mt-1 text-xs text-ns-ink-secondary">
                          {change.reason}
                        </p>
                      )}
                      <time
                        dateTime={change.createdAt}
                        className="text-xs text-ns-ink-muted"
                      >
                        {new Date(change.createdAt).toLocaleString()}
                      </time>
                    </div>
                    {index === 0 &&
                      change.action !== "undo" &&
                      change.revisionAfter === profile.data.revision && (
                        <button
                          type="button"
                          disabled={changed || busy}
                          onClick={() => undo.mutate(change)}
                          className="text-ns-accent underline disabled:opacity-50"
                        >
                          Undo latest change
                        </button>
                      )}
                  </div>
                  <details className="mt-2 text-xs text-ns-ink-secondary">
                    <summary className="cursor-pointer">
                      See what changed
                    </summary>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      {[
                        { label: "Before", value: change.before },
                        { label: "After", value: change.after },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="rounded-ns bg-ns-surface px-3 py-2"
                        >
                          <strong className="font-medium text-ns-ink">
                            {label}
                          </strong>
                          <p>
                            Point of view: {pointOfViewLabel(value.pointOfView)}
                            ; tense: {tenseLabel(value.tense)}
                          </p>
                          {value.notes.map((note) => (
                            <p
                              key={note.id}
                              className="mt-1 whitespace-pre-wrap"
                            >
                              {note.pinned ? "Pinned: " : ""}
                              {note.text}
                            </p>
                          ))}
                          {value.notes.length === 0 && <p>No notes</p>}
                        </div>
                      ))}
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
