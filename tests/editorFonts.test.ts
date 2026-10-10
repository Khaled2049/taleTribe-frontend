import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDITOR_FONT,
  EDITOR_FONTS,
  findEditorFont,
} from "@/components/editor/editorFonts";

describe("findEditorFont", () => {
  it("reads an unset font as the default", () => {
    expect(findEditorFont(null)).toBe(DEFAULT_EDITOR_FONT);
  });

  it("matches a stack the browser has re-quoted", () => {
    expect(findEditorFont('"Crimson Pro", Georgia, serif').label).toBe(
      "Crimson Pro",
    );
    expect(findEditorFont('"Times New Roman", serif').label).toBe(
      "Times New Roman",
    );
  });

  it("reads the old explicit system stack as the default", () => {
    expect(
      findEditorFont(
        '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
      ),
    ).toBe(DEFAULT_EDITOR_FONT);
  });

  it("names a font that is not in the list instead of hiding it", () => {
    expect(findEditorFont('"Comic Sans MS", cursive').label).toBe(
      "Comic Sans MS",
    );
  });

  it("round-trips every listed font", () => {
    for (const font of EDITOR_FONTS) {
      expect(findEditorFont(font.value)).toBe(font);
    }
  });
});
