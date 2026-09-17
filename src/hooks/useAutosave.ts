import { useState, useCallback, useRef, useEffect } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface SaveState {
  status: SaveStatus;
  lastSaved: Date | null;
  errorMessage?: string;
}

interface UseAutosaveOptions {
  onSave: (content: string) => Promise<number | undefined>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseAutosaveReturn {
  triggerSave: (content: string) => void;
  /**
   * Save immediately. Omit `content` to save the latest content the editor has
   * pushed (the single source of truth); pass an explicit string only when the
   * caller genuinely has fresher content than the editor.
   */
  forceSave: (content?: string) => Promise<void>;
  /** Save all queued editor content and resolve with its persisted revision. */
  flushAndWait: () => Promise<number | undefined>;
  /** Flush a pending debounced save now (e.g. on blur / tab hide). No-op if none. */
  flushSave: () => void;
  saveState: SaveState;
  isDirty: boolean;
  cancelPendingSave: () => void;
  resetSaveState: () => void;
}

export function useAutosave({
  onSave,
  debounceMs = 3000,
  enabled = true,
}: UseAutosaveOptions): UseAutosaveReturn {
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    lastSaved: null,
  });
  const [isDirty, setIsDirty] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The freshest content the editor has handed us — the single source of truth
  // for what gets persisted. Updated on every triggerSave/forceSave call.
  const latestContentRef = useRef<string>("");
  const isSavingRef = useRef(false);
  const isDirtyRef = useRef(false);
  const hasQueuedSaveRef = useRef(false);
  const lastSavedRef = useRef<Date | null>(null);
  const lastPersistedRevisionRef = useRef<number | undefined>(undefined);
  const saveWaitersRef = useRef<
    Array<{
      resolve: (revision: number | undefined) => void;
      reject: (error: unknown) => void;
    }>
  >([]);
  // Bumped on every reset (e.g. chapter switch). A save started under one
  // generation must not requeue or stamp state under a later one — otherwise an
  // in-flight save could write the new chapter's text via the old chapter's
  // save closure.
  const saveGenerationRef = useRef(0);

  const cancelPendingSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetSaveState = useCallback(() => {
    // Cancel any pending debounce here too — a discard-and-switch path may reset
    // without otherwise cancelling, and a stale timer firing post-switch would
    // save the wrong chapter.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    saveGenerationRef.current += 1;
    hasQueuedSaveRef.current = false;
    isDirtyRef.current = false;
    saveWaitersRef.current
      .splice(0)
      .forEach(({ resolve }) => resolve(undefined));
    setSaveState({ status: "idle", lastSaved: null });
    setIsDirty(false);
    lastSavedRef.current = null;
  }, []);

  const runSave = useCallback(
    async (initialContent: string) => {
      let contentToSave = initialContent;
      const myGeneration = saveGenerationRef.current;

      while (enabled) {
        isSavingRef.current = true;
        setSaveState((prev) => ({ ...prev, status: "saving" }));

        try {
          const persistedRevision = await onSave(contentToSave);

          // A reset (chapter switch) happened while this save was in flight: the
          // hook now belongs to a different chapter. Don't requeue with the new
          // chapter's content and don't stamp state that no longer applies.
          if (saveGenerationRef.current !== myGeneration) return;

          const now = new Date();
          lastSavedRef.current = now;
          lastPersistedRevisionRef.current = persistedRevision;

          if (hasQueuedSaveRef.current) {
            hasQueuedSaveRef.current = false;
            contentToSave = latestContentRef.current;
            continue;
          }

          setSaveState({ status: "saved", lastSaved: now });
          isDirtyRef.current = false;
          setIsDirty(false);
          saveWaitersRef.current
            .splice(0)
            .forEach(({ resolve }) => resolve(persistedRevision));
          return;
        } catch (error) {
          if (saveGenerationRef.current !== myGeneration) return;
          setSaveState({
            status: "error",
            lastSaved: lastSavedRef.current,
            errorMessage:
              error instanceof Error ? error.message : "Save failed",
          });
          saveWaitersRef.current
            .splice(0)
            .forEach(({ reject }) => reject(error));
          return;
        } finally {
          isSavingRef.current = false;
        }
      }
    },
    [enabled, onSave],
  );

  const forceSave = useCallback(
    async (content?: string) => {
      cancelPendingSave();
      if (!enabled) return;

      // Default to the latest editor content (single source of truth). Only an
      // explicit argument overrides it.
      const contentToSave = content ?? latestContentRef.current;
      latestContentRef.current = contentToSave;

      if (isSavingRef.current) {
        hasQueuedSaveRef.current = true;
        isDirtyRef.current = true;
        setIsDirty(true);
        setSaveState((prev) => ({ ...prev, status: "pending" }));
        return;
      }

      await runSave(contentToSave);
    },
    [runSave, enabled, cancelPendingSave],
  );

  const triggerSave = useCallback(
    (content: string) => {
      if (!enabled) return;

      latestContentRef.current = content;
      isDirtyRef.current = true;
      setIsDirty(true);
      setSaveState((prev) => ({
        ...prev,
        status: "pending",
      }));

      cancelPendingSave();

      timerRef.current = setTimeout(() => {
        forceSave(latestContentRef.current);
      }, debounceMs);
    },
    [enabled, debounceMs, forceSave, cancelPendingSave],
  );

  // Flush a *pending* debounced save immediately. Only acts when a debounce
  // timer is armed, so it's safe to call liberally (blur, tab hide). forceSave
  // handles the "already saving" case by queueing.
  const flushSave = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) {
      void forceSave();
    }
  }, [enabled, forceSave]);

  const flushAndWait = useCallback((): Promise<number | undefined> => {
    if (!enabled) return Promise.resolve(undefined);
    if (!timerRef.current && !isSavingRef.current && !isDirtyRef.current) {
      return Promise.resolve(lastPersistedRevisionRef.current);
    }
    const settled = new Promise<number | undefined>((resolve, reject) => {
      saveWaitersRef.current.push({ resolve, reject });
    });
    void forceSave();
    return settled;
  }, [enabled, forceSave]);

  // Flush when the tab is hidden (switching tabs, minimizing, mobile background)
  // so the user doesn't lose work sitting in the debounce window.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [flushSave]);

  // Warn before the tab is closed/reloaded while there are unsaved or in-flight
  // changes. Covers the cases the in-app "unsaved changes" dialog can't (tab
  // close, refresh, browser-back out of the SPA).
  useEffect(() => {
    if (!enabled) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty || isSavingRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, isDirty]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelPendingSave();
    };
  }, [cancelPendingSave]);

  return {
    triggerSave,
    forceSave,
    flushAndWait,
    flushSave,
    saveState,
    isDirty,
    cancelPendingSave,
    resetSaveState,
  };
}
