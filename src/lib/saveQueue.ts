export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface SaveState {
  status: SaveStatus;
  lastSaved: Date | null;
  errorMessage?: string;
}

/** Rejects a pending `flushAndWait` whose content was discarded by a reset. */
export class SaveCancelledError extends Error {
  constructor() {
    super("Save was cancelled before it completed.");
    this.name = "SaveCancelledError";
  }
}

export interface SaveQueueOptions {
  getOnSave: () => (content: string) => Promise<number | undefined>;
  isEnabled: () => boolean;
  debounceMs: number;
  onStateChange: (state: SaveState) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** Waits before each automatic retry of a failed save; none when omitted. */
  retryDelaysMs?: readonly number[];
  shouldRetry?: (error: unknown) => boolean;
}

interface Waiter {
  resolve: (revision: number | undefined) => void;
  reject: (error: unknown) => void;
}

/**
 * Debounced, serialized chapter saves. At most one `onSave` runs at a time;
 * edits made while it runs are coalesced into one follow-up save of the latest
 * content, and `flushAndWait` settles only after that whole chain persists.
 */
export class SaveQueue {
  private state: SaveState = { status: "idle", lastSaved: null };
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private latestContent = "";
  private saving = false;
  private queued = false;
  private retryAttempt = 0;
  private lastPersistedRevision: number | undefined;
  private waiters: Waiter[] = [];
  // Bumped on every reset (e.g. chapter switch). A save started under one
  // generation must not requeue or stamp state under a later one — otherwise an
  // in-flight save could write the new chapter's text via the old chapter's
  // save closure.
  private generation = 0;

  constructor(private readonly options: SaveQueueOptions) {}

  get isSaving() {
    return this.saving;
  }

  get isDirty() {
    return this.dirty;
  }

  cancelPending() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  reset() {
    this.cancelPending();
    this.generation += 1;
    // The superseded save may still be in flight, but it belongs to the old
    // chapter; the next chapter's first save must not queue behind it.
    this.saving = false;
    this.queued = false;
    this.retryAttempt = 0;
    this.settleWaiters((waiter) => waiter.reject(new SaveCancelledError()));
    this.state = { status: "idle", lastSaved: null };
    this.options.onStateChange(this.state);
    this.setDirty(false);
  }

  trigger(content: string) {
    if (!this.options.isEnabled()) return;
    this.latestContent = content;
    this.retryAttempt = 0;
    this.setDirty(true);
    this.setStatus("pending");
    this.cancelPending();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.force();
    }, this.options.debounceMs);
  }

  /**
   * Save now. Omit `content` to save the latest content the editor has pushed;
   * never rejects — use `flushAndWait` when the caller must know it persisted.
   */
  async force(content?: string) {
    this.cancelPending();
    if (!this.options.isEnabled()) return;
    this.latestContent = content ?? this.latestContent;

    if (this.saving) {
      this.queued = true;
      this.setDirty(true);
      this.setStatus("pending");
      return;
    }
    await this.run(this.latestContent);
  }

  /** Save unsaved content now if nothing is in flight (connection restored). */
  retryNow() {
    // A save forced without a preceding edit can fail without being dirty.
    const unsaved = this.dirty || this.state.status === "error";
    if (unsaved && !this.saving) void this.force();
  }

  /** Save a pending debounced edit now (blur, tab hide). No-op if none. */
  flushPending() {
    if (!this.options.isEnabled()) return;
    if (this.timer) void this.force();
  }

  /** Resolves with the persisted revision once every queued edit is saved. */
  flushAndWait(): Promise<number | undefined> {
    if (!this.options.isEnabled()) return Promise.resolve(undefined);
    if (!this.timer && !this.saving && !this.dirty) {
      return Promise.resolve(this.lastPersistedRevision);
    }
    const settled = new Promise<number | undefined>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
    // An in-flight save with no newer edit already carries the latest content.
    if (this.timer || !this.saving) void this.force();
    return settled;
  }

  private async run(initialContent: string) {
    let contentToSave = initialContent;
    const myGeneration = this.generation;

    while (this.options.isEnabled()) {
      this.saving = true;
      this.setStatus("saving");

      try {
        const persistedRevision = await this.options.getOnSave()(contentToSave);
        if (this.generation !== myGeneration) return;

        const now = new Date();
        this.lastPersistedRevision = persistedRevision;

        if (this.queued) {
          this.queued = false;
          contentToSave = this.latestContent;
          this.state = { ...this.state, lastSaved: now };
          continue;
        }

        this.retryAttempt = 0;
        this.state = { status: "saved", lastSaved: now };
        this.options.onStateChange(this.state);
        this.setDirty(false);
        this.settleWaiters((waiter) => waiter.resolve(persistedRevision));
        return;
      } catch (error) {
        if (this.generation !== myGeneration) return;
        this.state = {
          status: "error",
          lastSaved: this.state.lastSaved,
          errorMessage: error instanceof Error ? error.message : "Save failed",
        };
        this.options.onStateChange(this.state);
        this.settleWaiters((waiter) => waiter.reject(error));
        this.scheduleRetry(error);
        return;
      } finally {
        if (this.generation === myGeneration) this.saving = false;
      }
    }
  }

  // Shares the debounce timer, so a new edit, a flush or a reset replaces it.
  private scheduleRetry(error: unknown) {
    const delay = this.options.retryDelaysMs?.[this.retryAttempt];
    if (delay === undefined || !this.options.shouldRetry?.(error)) return;
    this.retryAttempt += 1;
    this.cancelPending();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.force();
    }, delay);
  }

  // Typing calls trigger on every keystroke; re-emitting an unchanged status
  // or dirty flag would re-render the whole editor page each time.
  private setStatus(status: SaveStatus) {
    if (this.state.status === status) return;
    this.state = { ...this.state, status };
    this.options.onStateChange(this.state);
  }

  private setDirty(dirty: boolean) {
    if (this.dirty === dirty) return;
    this.dirty = dirty;
    this.options.onDirtyChange(dirty);
  }

  private settleWaiters(settle: (waiter: Waiter) => void) {
    this.waiters.splice(0).forEach(settle);
  }
}
