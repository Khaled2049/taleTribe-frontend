/** Below this many pages every number is shown, so nothing is elided. */
const ELISION_THRESHOLD = 7;

/**
 * Page numbers to render in a pagination control, with `null` marking an
 * elided run to be drawn as an ellipsis.
 *
 * Always keeps the first and last page plus the current one and its immediate
 * neighbours, so the control stays a fixed width no matter how many pages
 * exist rather than growing a row of numbers off the edge of the page.
 *
 *   pageItems(1, 3)   -> [1, 2, 3]
 *   pageItems(5, 20)  -> [1, null, 4, 5, 6, null, 20]
 *   pageItems(1, 20)  -> [1, 2, null, 20]
 *   pageItems(20, 20) -> [1, null, 19, 20]
 */
export function pageItems(current: number, total: number): (number | null)[] {
  if (total <= ELISION_THRESHOLD) {
    return Array.from({ length: Math.max(0, total) }, (_, index) => index + 1);
  }

  const items: (number | null)[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push(null);
  for (let page = start; page <= end; page++) items.push(page);
  if (end < total - 1) items.push(null);
  items.push(total);

  return items;
}
