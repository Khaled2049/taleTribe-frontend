export type SidebarSide = "left" | "right";

type ShortcutEvent = Pick<
  KeyboardEvent,
  "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat"
>;

/**
 * Mod+\ is the left panel, Mod+Shift+\ the right. Backslash is bound by
 * neither the browser nor TipTap; Mod+B, the code-editor default, is bold.
 */
export function sidebarShortcut(event: ShortcutEvent): SidebarSide | null {
  if (event.code !== "Backslash" || event.repeat || event.altKey) return null;
  if (event.metaKey === event.ctrlKey) return null;
  return event.shiftKey ? "right" : "left";
}

export function sidebarShortcutLabel(side: SidebarSide): string {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  const shift = side === "right";
  if (isMac) return shift ? "⇧⌘\\" : "⌘\\";
  return shift ? "Ctrl+Shift+\\" : "Ctrl+\\";
}
