import { describe, expect, it } from "vitest";
import { sidebarShortcut } from "@/lib/sidebarShortcut";

const key = (overrides: Partial<Parameters<typeof sidebarShortcut>[0]>) => ({
  code: "Backslash",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  ...overrides,
});

describe("sidebarShortcut", () => {
  it("maps Mod+\\ to the left panel and Mod+Shift+\\ to the right", () => {
    expect(sidebarShortcut(key({ metaKey: true }))).toBe("left");
    expect(sidebarShortcut(key({ ctrlKey: true }))).toBe("left");
    expect(sidebarShortcut(key({ metaKey: true, shiftKey: true }))).toBe(
      "right",
    );
  });

  it("ignores a bare backslash so it can still be typed", () => {
    expect(sidebarShortcut(key({}))).toBeNull();
    expect(sidebarShortcut(key({ shiftKey: true }))).toBeNull();
  });

  it("leaves editing shortcuts alone", () => {
    for (const code of ["KeyB", "KeyC", "KeyV", "KeyX", "KeyZ", "KeyA"]) {
      expect(sidebarShortcut(key({ code, metaKey: true }))).toBeNull();
      expect(sidebarShortcut(key({ code, ctrlKey: true }))).toBeNull();
    }
  });

  it("ignores Alt combinations, both modifiers at once, and key repeat", () => {
    expect(sidebarShortcut(key({ metaKey: true, altKey: true }))).toBeNull();
    expect(sidebarShortcut(key({ metaKey: true, ctrlKey: true }))).toBeNull();
    expect(sidebarShortcut(key({ metaKey: true, repeat: true }))).toBeNull();
  });
});
