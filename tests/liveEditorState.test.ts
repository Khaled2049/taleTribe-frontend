import { describe, expect, it } from "vitest";
import { sameStructure } from "@/components/editor/useLiveEditorState";

const entry = (text: string, pos: number, level = 1) => ({ text, pos, level });

describe("sameStructure", () => {
  it("ignores heading positions shifted by typing above them", () => {
    expect(
      sameStructure(
        { outline: [entry("One", 10), entry("Two", 90)], canSplit: true },
        { outline: [entry("One", 14), entry("Two", 94)], canSplit: true },
      ),
    ).toBe(true);
  });

  it("notices a renamed, re-levelled, added or removed heading", () => {
    const base = { outline: [entry("One", 0)], canSplit: false };
    expect(
      sameStructure(base, { outline: [entry("Uno", 0)], canSplit: false }),
    ).toBe(false);
    expect(
      sameStructure(base, { outline: [entry("One", 0, 2)], canSplit: false }),
    ).toBe(false);
    expect(
      sameStructure(base, {
        outline: [entry("One", 0), entry("Two", 5)],
        canSplit: false,
      }),
    ).toBe(false);
    expect(sameStructure(base, { outline: [], canSplit: false })).toBe(false);
  });

  it("notices a change in whether the document can split", () => {
    expect(
      sameStructure(
        { outline: [entry("One", 0)], canSplit: false },
        { outline: [entry("One", 0)], canSplit: true },
      ),
    ).toBe(false);
  });

  it("treats a missing previous value as changed", () => {
    expect(sameStructure({ outline: [], canSplit: false }, null)).toBe(false);
  });
});
