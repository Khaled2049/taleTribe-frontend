// Shared by the launcher and the panel. Kept out of AssistantPanel so the
// launcher can render the closed assistant without downloading it.

export const ASSISTANT_DOCK_OPEN_KEY = "tale-tribe:assistant-dock-open";
export const ASSISTANT_DOCK_WIDTH_KEY = "tale-tribe:assistant-dock-width";
export const MIN_DOCK_WIDTH = 360;
export const MAX_DOCK_WIDTH = 560;

export function initialDockOpen() {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(ASSISTANT_DOCK_OPEN_KEY);
  return stored === null ? true : stored === "true";
}

export function clampDockWidth(width: number) {
  if (typeof window === "undefined") {
    return Math.min(MAX_DOCK_WIDTH, Math.max(MIN_DOCK_WIDTH, width));
  }
  const viewportMaximum = Math.max(
    MIN_DOCK_WIDTH,
    Math.min(MAX_DOCK_WIDTH, window.innerWidth * 0.48),
  );
  return Math.min(viewportMaximum, Math.max(MIN_DOCK_WIDTH, width));
}

export function initialDockWidth() {
  if (typeof window === "undefined") return 448;
  const stored = Number(window.localStorage.getItem(ASSISTANT_DOCK_WIDTH_KEY));
  return clampDockWidth(Number.isFinite(stored) && stored > 0 ? stored : 448);
}

/**
 * Whether the assistant is needed yet. A closed assistant needs nothing. A dock
 * restored open from a previous visit waits for the editor, so its chunk and
 * thread reads do not compete with the canvas; a dock the writer just opened
 * does not. Once mounted it stays mounted (the caller latches this), so closing
 * never cancels a run or drops a conversation.
 */
export function assistantWanted(state: {
  isLgUp: boolean;
  desktopOpen: boolean;
  mobileOpen: boolean;
  openedByWriter: boolean;
  onEditorRoute: boolean;
  editorReady: boolean;
  waitExpired: boolean;
}) {
  if (!state.isLgUp) return state.mobileOpen;
  if (!state.desktopOpen) return false;
  const waiting =
    !state.openedByWriter &&
    state.onEditorRoute &&
    !state.editorReady &&
    !state.waitExpired;
  return !waiting;
}
