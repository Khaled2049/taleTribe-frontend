import { describe, expect, it } from "vitest";
import { splitLevelFor } from "../src/utils/documentOutline";

describe("splitLevelFor", () => {
  it("returns null when the document has no headings", () => {
    expect(splitLevelFor([])).toBeNull();
  });

  it("cuts at H1 when H1s are present", () => {
    expect(splitLevelFor([1, 2, 2, 1, 3])).toBe(1);
  });

  it("cuts at H2 for a writer who never used H1", () => {
    expect(splitLevelFor([2, 3, 2, 3])).toBe(2);
  });

  it("cuts at the shallowest level regardless of which comes first", () => {
    expect(splitLevelFor([3, 3, 2, 3])).toBe(2);
  });

  it("handles a single heading", () => {
    expect(splitLevelFor([2])).toBe(2);
  });
});
