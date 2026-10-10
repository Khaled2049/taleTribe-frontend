import { useCallback, useEffect, useState } from "react";

export type EditorZoom = number | "fit";

export const ZOOM_LEVELS = [50, 75, 90, 100, 125, 150, 200];
/** Unzoomed width of the writing page, in CSS pixels. */
export const EDITOR_PAGE_WIDTH = 896;

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const STORAGE_KEY = "editorZoom";

/** Percent to scale the page by; "fit" fills the available column width. */
export function resolveZoom(zoom: EditorZoom, availableWidth: number): number {
  if (zoom !== "fit") return zoom;
  if (availableWidth <= 0) return 100;
  const fit = Math.round((availableWidth / EDITOR_PAGE_WIDTH) * 100);
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fit));
}

export function parseStoredZoom(stored: string | null): EditorZoom {
  if (stored === "fit") return "fit";
  const value = Number(stored);
  return ZOOM_LEVELS.includes(value) ? value : 100;
}

function readStoredZoom(): EditorZoom {
  try {
    return parseStoredZoom(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 100;
  }
}

/** Zoom choice remembered per browser, plus the percent it resolves to. */
export function useEditorZoom(container: HTMLElement | null) {
  const [zoom, setZoomState] = useState<EditorZoom>(readStoredZoom);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    if (!container || zoom !== "fit") return;
    const observer = new ResizeObserver(([entry]) =>
      setAvailableWidth(entry.contentRect.width),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [container, zoom]);

  const setZoom = useCallback((next: EditorZoom) => {
    setZoomState(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Private windows can refuse storage; the choice still holds for the session.
    }
  }, []);

  return { zoom, setZoom, zoomPercent: resolveZoom(zoom, availableWidth) };
}
