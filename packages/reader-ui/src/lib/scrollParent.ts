type StyleReader = (element: Element) => Pick<CSSStyleDeclaration, "overflowY">;

const SCROLLING = new Set(["auto", "scroll", "overlay"]);

export function findScrollParent(
  node: Element,
  readStyle: StyleReader = (element) => getComputedStyle(element),
): Element | null {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (SCROLLING.has(readStyle(parent).overflowY)) return parent;
  }
  return null;
}
