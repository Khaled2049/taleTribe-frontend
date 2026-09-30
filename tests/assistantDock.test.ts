import { describe, expect, it } from "vitest";
import { assistantWanted } from "@/components/chat/assistantDock";

const desktopRestoredOpen = {
  isLgUp: true,
  desktopOpen: true,
  mobileOpen: false,
  openedByWriter: false,
  onEditorRoute: true,
  editorReady: false,
  waitExpired: false,
};

describe("assistantWanted on mobile", () => {
  const mobile = { ...desktopRestoredOpen, isLgUp: false };

  it("is not needed while the sheet is closed, even if the dock was stored open", () => {
    expect(assistantWanted(mobile)).toBe(false);
  });

  it("is needed once the sheet opens, without waiting for the editor", () => {
    expect(assistantWanted({ ...mobile, mobileOpen: true })).toBe(true);
  });
});

describe("assistantWanted on desktop", () => {
  it("is not needed while the dock is closed", () => {
    expect(
      assistantWanted({
        ...desktopRestoredOpen,
        desktopOpen: false,
        editorReady: true,
      }),
    ).toBe(false);
  });

  it("holds a restored-open dock back until the editor is ready", () => {
    expect(assistantWanted(desktopRestoredOpen)).toBe(false);
    expect(assistantWanted({ ...desktopRestoredOpen, editorReady: true })).toBe(
      true,
    );
  });

  it("stops waiting when the editor never becomes ready", () => {
    expect(assistantWanted({ ...desktopRestoredOpen, waitExpired: true })).toBe(
      true,
    );
  });

  it("does not wait on workspace tabs without an editor", () => {
    expect(
      assistantWanted({ ...desktopRestoredOpen, onEditorRoute: false }),
    ).toBe(true);
  });

  it("opens immediately when the writer opens it", () => {
    expect(
      assistantWanted({ ...desktopRestoredOpen, openedByWriter: true }),
    ).toBe(true);
  });
});
