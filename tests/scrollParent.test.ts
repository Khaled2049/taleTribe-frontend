import { describe, expect, it } from "vitest";
import { findScrollParent } from "@/lib/scrollParent";

type FakeElement = {
  name: string;
  overflowY: string;
  parentElement: FakeElement | null;
};

const chain = (...levels: [string, string][]) => {
  let parent: FakeElement | null = null;
  for (const [name, overflowY] of levels.reverse()) {
    parent = { name, overflowY, parentElement: parent };
  }
  return parent as FakeElement;
};

const readStyle = (element: Element) => ({
  overflowY: (element as unknown as FakeElement).overflowY,
});

const find = (node: FakeElement) =>
  findScrollParent(
    node as unknown as Element,
    readStyle,
  ) as unknown as FakeElement | null;

describe("findScrollParent", () => {
  it("finds the nearest ancestor that scrolls vertically", () => {
    const sentinel = chain(
      ["sentinel", "visible"],
      ["grid", "visible"],
      ["main", "auto"],
      ["shell", "hidden"],
      ["body", "visible"],
    );

    expect(find(sentinel)?.name).toBe("main");
  });

  it("skips a clipping ancestor that does not scroll", () => {
    const sentinel = chain(
      ["sentinel", "visible"],
      ["card", "hidden"],
      ["list", "scroll"],
    );

    expect(find(sentinel)?.name).toBe("list");
  });

  it("does not treat the node itself as its scroll parent", () => {
    const sentinel = chain(["sentinel", "auto"], ["page", "visible"]);

    expect(find(sentinel)).toBeNull();
  });

  it("falls back to the viewport when nothing scrolls", () => {
    const sentinel = chain(["sentinel", "visible"], ["body", "visible"]);

    expect(find(sentinel)).toBeNull();
  });
});
