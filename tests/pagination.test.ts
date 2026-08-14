import { describe, expect, it } from "vitest";
import { pageItems } from "../src/lib/pagination";

/** Ellipses are `null`; this makes the expectations readable. */
const render = (current: number, total: number): string =>
  pageItems(current, total)
    .map((item) => (item === null ? "…" : String(item)))
    .join(" ");

describe("pageItems", () => {
  it("lists every page when there are few enough to fit", () => {
    expect(render(1, 1)).toBe("1");
    expect(render(1, 3)).toBe("1 2 3");
    expect(render(4, 7)).toBe("1 2 3 4 5 6 7");
  });

  it("elides only the far side when near the start", () => {
    expect(render(1, 20)).toBe("1 2 … 20");
    expect(render(2, 20)).toBe("1 2 3 … 20");
    expect(render(3, 20)).toBe("1 2 3 4 … 20");
  });

  it("elides only the near side when near the end", () => {
    expect(render(20, 20)).toBe("1 … 19 20");
    expect(render(19, 20)).toBe("1 … 18 19 20");
    expect(render(18, 20)).toBe("1 … 17 18 19 20");
  });

  it("elides both sides in the middle", () => {
    expect(render(5, 20)).toBe("1 … 4 5 6 … 20");
    expect(render(10, 20)).toBe("1 … 9 10 11 … 20");
  });

  it("never repeats a page number", () => {
    for (let total = 1; total <= 30; total++) {
      for (let current = 1; current <= total; current++) {
        const numbers = pageItems(current, total).filter(
          (item): item is number => item !== null,
        );
        expect(new Set(numbers).size).toBe(numbers.length);
      }
    }
  });

  it("always keeps the first, last and current page reachable", () => {
    for (let total = 1; total <= 30; total++) {
      for (let current = 1; current <= total; current++) {
        const numbers = pageItems(current, total);
        expect(numbers).toContain(1);
        expect(numbers).toContain(total);
        expect(numbers).toContain(current);
      }
    }
  });

  it("stays a bounded width however many pages there are", () => {
    // The whole point of eliding: the control must not grow off the page.
    for (const total of [8, 50, 500, 10_000]) {
      for (const current of [1, 2, Math.floor(total / 2), total - 1, total]) {
        expect(pageItems(current, total).length).toBeLessThanOrEqual(7);
      }
    }
  });

  it("returns nothing for an empty set rather than a phantom page", () => {
    expect(pageItems(1, 0)).toEqual([]);
  });
});
