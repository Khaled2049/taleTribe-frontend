import { describe, expect, it } from "vitest";
import {
  UNASSIGNED,
  chapterFor,
  chapterIdFromSelect,
  chapterOptions,
  chapterSelectValue,
} from "@/components/plot/plotChapters";

const index = [
  { id: "c3", title: "The Storm", order: 7.5 },
  { id: "c1", title: "The Harbour", order: 1 },
  { id: "c2", title: "  ", order: 4 },
];

describe("chapterOptions", () => {
  it("numbers chapters by reading order, not by their position values", () => {
    expect(chapterOptions(index).map((c) => c.label)).toEqual([
      "1 · The Harbour",
      "2 · Untitled",
      "3 · The Storm",
    ]);
  });

  it("renumbers when chapters are reordered, keeping ids", () => {
    const moved = index.map((c) => (c.id === "c3" ? { ...c, order: 0 } : c));
    const options = chapterOptions(moved);
    expect(chapterFor(options, "c3")?.number).toBe(1);
    expect(chapterFor(options, "c1")?.number).toBe(2);
  });

  it("is empty before the index loads", () => {
    expect(chapterOptions(undefined)).toEqual([]);
  });
});

describe("chapter select values", () => {
  const options = chapterOptions(index);

  it("maps Unassigned to null and a chapter to its id", () => {
    expect(chapterIdFromSelect(UNASSIGNED)).toBeNull();
    expect(chapterIdFromSelect("c2")).toBe("c2");
  });

  it("shows an event whose chapter is gone as Unassigned", () => {
    expect(chapterSelectValue(options, "deleted")).toBe(UNASSIGNED);
    expect(chapterSelectValue(options, null)).toBe(UNASSIGNED);
    expect(chapterSelectValue(options, "c1")).toBe("c1");
  });
});
