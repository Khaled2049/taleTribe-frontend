import { useState, useCallback, useRef, useEffect } from "react";
import { SaveQueue, SaveState } from "@/lib/saveQueue";

export type { SaveStatus, SaveState } from "@/lib/saveQueue";

interface UseAutosaveOptions {
  onSave: (content: string) => Promise<number | undefined>;
  debounceMs?: number;
  enabled?: boolean;
  /** Which failures are worth retrying unattended; none when omitted. */
  shouldRetry?: (error: unknown) => boolean;
}

const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 60_000];

interface UseAutosaveReturn {
  triggerSave: (content: string) => void;
  /**
   * Save immediately. Omit `content` to save the latest content the editor has
   * pushed (the single source of truth); pass an explicit string only when the
   * caller genuinely has fresher content than the editor. Never rejects.
   */
  forceSave: (content?: string) => Promise<void>;
  /**
   * Save all queued editor content and resolve with its persisted revision.
   * Rejects if the save fails or a reset discards it, so it is the barrier to
   * await before leaving a chapter.
   */
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
  shouldRetry,
}: UseAutosaveOptions): UseAutosaveReturn {
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    lastSaved: null,
  });
  const [isDirty, setIsDirty] = useState(false);
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);
  const shouldRetryRef = useRef(shouldRetry);
  onSaveRef.current = onSave;
  enabledRef.current = enabled;
  shouldRetryRef.current = shouldRetry;

  const [queue] = useState(
    () =>
      new SaveQueue({
        getOnSave: () => onSaveRef.current,
        isEnabled: () => enabledRef.current,
        debounceMs,
        onStateChange: setSaveState,
        onDirtyChange: setIsDirty,
        retryDelaysMs: RETRY_DELAYS_MS,
        shouldRetry: (error) => shouldRetryRef.current?.(error) ?? false,
      }),
  );

  const triggerSave = useCallback(
    (content: string) => queue.trigger(content),
    [queue],
  );
  const forceSave = useCallback(
    (content?: string) => queue.force(content),
    [queue],
  );
  const flushAndWait = useCallback(() => queue.flushAndWait(), [queue]);
  const flushSave = useCallback(() => queue.flushPending(), [queue]);
  const cancelPendingSave = useCallback(() => queue.cancelPending(), [queue]);
  const resetSaveState = useCallback(() => queue.reset(), [queue]);

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

  useEffect(() => {
    const handleOnline = () => queue.retryNow();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [queue]);

  // Warn before the tab is closed/reloaded while there are unsaved or in-flight
  // changes. Covers the cases the in-app "unsaved changes" dialog can't (tab
  // close, refresh, browser-back out of the SPA).
  useEffect(() => {
    if (!enabled) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty || queue.isSaving) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, isDirty, queue]);

  // Leaving for another workspace tab unmounts the editor; save the debounced
  // edit rather than dropping it. The route has no navigation blocker.
  useEffect(() => flushSave, [flushSave]);

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
