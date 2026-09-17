/**
 * Zustand store conventions
 * - Keep one store per domain (avoid a mega-store).
 * - Select only what a component needs to reduce re-renders.
 * - Keep async domain actions inside store actions.
 * - Persist preferences only (theme, reader settings), never auth or chat data.
 */
export * from "./authStore";
export * from "./demoStore";
export * from "./focusModeStore";
export * from "./readerSettingsStore";
export * from "./themeStore";
