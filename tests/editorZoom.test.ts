import { describe, expect, it } from "vitest";
import {
  EDITOR_PAGE_WIDTH,
  parseStoredZoom,
  resolveZoom,
} from "@/components/editor/editorZoom";

describe("resolveZoom", () => {
  it("passes a fixed level through", () => {
    expect(resolveZoom(125, 400)).toBe(125);
  });

  it("scales the page to the column for fit", () => {
    expect(resolveZoom("fit", EDITOR_PAGE_WIDTH * 1.5)).toBe(150);
    expect(resolveZoom("fit", EDITOR_PAGE_WIDTH)).toBe(100);
  });

  it("keeps fit within the menu's range", () => {
    expect(resolveZoom("fit", 200)).toBe(50);
    expect(resolveZoom("fit", 5000)).toBe(200);
  });

  it("holds at 100% until the column has been measured", () => {
    expect(resolveZoom("fit", 0)).toBe(100);
  });
});

describe("parseStoredZoom", () => {
  it("restores a saved choice and ignores anything else", () => {
    expect(parseStoredZoom("fit")).toBe("fit");
    expect(parseStoredZoom("150")).toBe(150);
    expect(parseStoredZoom("999")).toBe(100);
    expect(parseStoredZoom(null)).toBe(100);
  });
});
