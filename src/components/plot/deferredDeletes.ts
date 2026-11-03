/**
 * Deletes that wait out an undo window before reaching the server. Until then
 * the record stays in the cache and is only hidden, so Undo restores it exactly.
 */
export class DeferredDeletes {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Sent and awaiting the server; still hidden so the row doesn't flash back. */
  private running = new Set<string>();
  private listeners = new Set<() => void>();
  private snapshot: ReadonlySet<string> = new Set();

  schedule(id: string, run: () => void | Promise<void>, delayMs: number) {
    this.cancel(id);
    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id);
        this.running.add(id);
        void Promise.resolve()
          .then(run)
          .catch(() => {})
          .finally(() => {
            this.running.delete(id);
            this.changed();
          });
      }, delayMs),
    );
    this.changed();
  }

  /** True when the delete was still waiting and is now called off. */
  undo(id: string): boolean {
    if (!this.timers.has(id)) return false;
    this.cancel(id);
    this.changed();
    return true;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ReadonlySet<string> => this.snapshot;

  private cancel(id: string) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }

  private changed() {
    this.snapshot = new Set([...this.timers.keys(), ...this.running]);
    for (const listener of this.listeners) listener();
  }
}
