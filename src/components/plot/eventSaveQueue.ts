import { StoryDataConflictError } from "@novelsync/story-data-client";
import type { PlotEvent, PlotLine } from "@/types/IPlot";

/**
 * One save in flight per event: edits made meanwhile are merged and sent after
 * it with its new revision, so they can't race into a 409, and its response
 * can't overwrite them. Failures keep the local value and never retry silently.
 */

export type EventSaveState =
  "pending" | "saving" | "saved" | "error" | "conflict";

export interface EventSaveStatus {
  lineId: string;
  state: EventSaveState;
}

export interface EventSaveQueueDeps {
  send(lineId: string, event: PlotEvent): Promise<PlotEvent>;
  /** Write the server's copy to the cache; `revisionOnly` when newer local edits exist. */
  applySaved(lineId: string, saved: PlotEvent, revisionOnly: boolean): void;
  debounceMs?: number;
  /** How long "saved" shows before the event drops out of the status map. */
  savedMs?: number;
}

interface Entry {
  lineId: string;
  /** The newest local value not yet sent. */
  latest: PlotEvent | null;
  sending: PlotEvent | null;
  /** The newest revision the server has returned. */
  revision?: number;
  inFlight: boolean;
  /** The debounce ran out while a save was in flight: send when it returns. */
  due: boolean;
  failure?: "error" | "conflict";
  saved: boolean;
  timer?: ReturnType<typeof setTimeout>;
  savedTimer?: ReturnType<typeof setTimeout>;
}

const EMPTY: ReadonlyMap<string, EventSaveStatus> = new Map();

export class EventSaveQueue {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private snapshot: ReadonlyMap<string, EventSaveStatus> = EMPTY;
  private readonly debounceMs: number;
  private readonly savedMs: number;

  constructor(private readonly deps: EventSaveQueueDeps) {
    this.debounceMs = deps.debounceMs ?? 600;
    this.savedMs = deps.savedMs ?? 2000;
  }

  /** Record an edit. `immediate` skips the debounce (a dialog's Save button). */
  schedule(lineId: string, event: PlotEvent, { immediate = false } = {}) {
    const entry = this.entries.get(event.id) ?? this.create(event.id, lineId);
    entry.lineId = lineId;
    entry.latest = event;
    entry.saved = false;
    clearTimeout(entry.savedTimer);
    clearTimeout(entry.timer);
    entry.timer = undefined;
    // A conflict holds the edit locally until the writer reloads.
    if (entry.failure === "conflict") return this.changed();
    entry.failure = undefined;
    if (immediate) this.fire(event.id);
    else entry.timer = setTimeout(() => this.fire(event.id), this.debounceMs);
    this.changed();
  }

  /** Send every debounced edit now. Failed saves stay failed. */
  flush() {
    for (const [id, entry] of this.entries) {
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = undefined;
        this.fire(id);
      }
    }
  }

  /** Resend the newest local value of failed saves (not conflicts). */
  retry(eventIds: Iterable<string>) {
    for (const id of eventIds) {
      const entry = this.entries.get(id);
      if (entry?.failure !== "error" || !entry.latest) continue;
      entry.failure = undefined;
      this.send(id);
    }
    this.changed();
  }

  /** Forget an event: its pending edit and any in-flight result are dropped. */
  discard(eventId: string) {
    const entry = this.entries.get(eventId);
    if (!entry) return;
    clearTimeout(entry.timer);
    clearTimeout(entry.savedTimer);
    this.entries.delete(eventId);
    this.changed();
  }

  /**
   * Keeps an event's pending edit in step with a move made by another call:
   * later saves go to its new plot line, and carry the fields the move set
   * (a new chapterId), so they don't undo it.
   */
  relocate(eventId: string, lineId?: string, patch?: Partial<PlotEvent>) {
    const entry = this.entries.get(eventId);
    if (!entry) return;
    if (lineId) entry.lineId = lineId;
    if (patch && entry.latest) entry.latest = { ...entry.latest, ...patch };
    this.changed();
  }

  /** The local value the server may not have yet: unsent, in flight or failed. */
  local(eventId: string): PlotEvent | null {
    const entry = this.entries.get(eventId);
    return entry?.latest ?? entry?.sending ?? null;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ReadonlyMap<string, EventSaveStatus> => this.snapshot;

  private create(id: string, lineId: string): Entry {
    const entry: Entry = {
      lineId,
      latest: null,
      sending: null,
      inFlight: false,
      due: false,
      saved: false,
    };
    this.entries.set(id, entry);
    return entry;
  }

  private fire(id: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.timer = undefined;
    if (entry.inFlight) entry.due = true;
    else this.send(id);
  }

  private send(id: string) {
    const entry = this.entries.get(id);
    if (!entry?.latest) return;
    const event = {
      ...entry.latest,
      revision: Math.max(entry.latest.revision ?? 0, entry.revision ?? 0),
    };
    entry.latest = null;
    entry.sending = event;
    entry.inFlight = true;
    entry.due = false;
    this.changed();

    this.deps.send(entry.lineId, event).then(
      (saved) => {
        if (this.entries.get(id) !== entry) return; // discarded meanwhile
        entry.inFlight = false;
        entry.sending = null;
        entry.revision = saved.revision;
        const newer = entry.latest !== null;
        this.deps.applySaved(entry.lineId, saved, newer);
        if (newer) {
          if (entry.due) this.send(id);
        } else {
          entry.saved = true;
          entry.savedTimer = setTimeout(() => this.settle(id), this.savedMs);
        }
        this.changed();
      },
      (error: unknown) => {
        if (this.entries.get(id) !== entry) return;
        entry.inFlight = false;
        entry.sending = null;
        entry.due = false;
        clearTimeout(entry.timer);
        entry.timer = undefined;
        entry.latest = entry.latest ?? event;
        entry.failure =
          error instanceof StoryDataConflictError ? "conflict" : "error";
        this.changed();
      },
    );
  }

  /** Drop a saved, idle event from the status map. */
  private settle(id: string) {
    const entry = this.entries.get(id);
    if (!entry || entry.inFlight || entry.latest || entry.failure) return;
    this.entries.delete(id);
    this.changed();
  }

  private changed() {
    const next = new Map<string, EventSaveStatus>();
    for (const [id, entry] of this.entries) {
      const state: EventSaveState | null = entry.failure
        ? entry.failure
        : entry.inFlight
          ? "saving"
          : entry.latest
            ? "pending"
            : entry.saved
              ? "saved"
              : null;
      if (state) next.set(id, { lineId: entry.lineId, state });
    }
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

/**
 * The most serious state for the save indicator, for one line or (without a
 * lineId) the whole story; null when there is nothing to show.
 */
export function lineSaveState(
  statuses: ReadonlyMap<string, EventSaveStatus>,
  lineId?: string,
): EventSaveState | null {
  let result: EventSaveState | null = null;
  const rank: Record<EventSaveState, number> = {
    saved: 1,
    pending: 2,
    saving: 3,
    error: 4,
    conflict: 5,
  };
  for (const status of statuses.values()) {
    if (lineId && status.lineId !== lineId) continue;
    if (!result || rank[status.state] > rank[result]) result = status.state;
  }
  return result;
}

/** Events in a given state, in one line or (without a lineId) anywhere. */
export function eventsInState(
  statuses: ReadonlyMap<string, EventSaveStatus>,
  lineId: string | undefined,
  state: EventSaveState,
): string[] {
  return [...statuses]
    .filter(([, s]) => (!lineId || s.lineId === lineId) && s.state === state)
    .map(([id]) => id);
}

/**
 * Lay unsaved local edits over fetched lines, so a refetch can't revert them.
 * The local revision is kept: taking the fetched one would let an edit
 * silently overwrite another writer's change instead of getting a 409.
 */
export function withLocalEdits(
  lines: PlotLine[],
  local: (eventId: string) => PlotEvent | null,
): PlotLine[] {
  return lines.map((line) => {
    let changed = false;
    const events = line.events.map((event) => {
      const mine = local(event.id);
      if (!mine) return event;
      changed = true;
      return mine;
    });
    return changed ? { ...line, events } : line;
  });
}
