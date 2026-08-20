import { describe, expect, it } from "vitest";
import { spoilerRangeField } from "../src/lib/spoilerRange";

/**
 * These assert absence, not undefined-ness. `toBeUndefined()` passes for both,
 * and the difference is the whole bug: Firestore rejects a key that is present
 * with an undefined value.
 */
describe("spoilerRangeField", () => {
  it("omits the key entirely for a message with no spoiler", () => {
    const field = spoilerRangeField(undefined);
    expect(Object.keys(field)).toEqual([]);
    expect("spoilerChapterRange" in field).toBe(false);
  });

  it("omits `end` for an open-ended range rather than setting it undefined", () => {
    const field = spoilerRangeField({ start: 3 });
    expect(field.spoilerChapterRange).toEqual({ start: 3 });
    expect("end" in field.spoilerChapterRange!).toBe(false);
  });

  it("drops an explicitly-undefined `end`", () => {
    const field = spoilerRangeField({ start: 3, end: undefined });
    expect("end" in field.spoilerChapterRange!).toBe(false);
  });

  it("keeps a closed range intact", () => {
    expect(spoilerRangeField({ start: 3, end: 7 }).spoilerChapterRange).toEqual({
      start: 3,
      end: 7,
    });
  });

  it("keeps chapter 0, which is falsy but valid", () => {
    const field = spoilerRangeField({ start: 0, end: 0 });
    expect(field.spoilerChapterRange).toEqual({ start: 0, end: 0 });
  });
});
