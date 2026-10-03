/**
 * The page does not scroll on `window`: NavbarWrapper pins the shell to the
 * viewport and scrolls its <main>. Anything that locks scrolling or observes
 * it has to target that element, or it silently acts on a box that never moves.
 */
export const APP_SCROLL_ATTRIBUTE = "data-app-scroll";

export const appScrollContainer = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[${APP_SCROLL_ATTRIBUTE}]`);
