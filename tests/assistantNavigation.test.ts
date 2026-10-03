import { describe, expect, it } from "vitest";
import {
  safeWebReferenceUrl,
  toolNavigationTarget,
} from "@/components/chat/assistantNavigation";

describe("assistant navigation", () => {
  it("routes only validated workspace destinations", () => {
    expect(
      toolNavigationTarget(
        "story 1",
        "read_chapter",
        { chapterId: "chapter-2" },
        null,
      ),
    ).toEqual({
      to: "/create/story%201",
      label: "Open chapter",
      state: { assistantChapterId: "chapter-2" },
    });
    expect(
      toolNavigationTarget(
        "story-1",
        "get_story_entity",
        { kind: "character", entityId: "char-1" },
        null,
      ),
    ).toEqual({
      to: "/create/story-1/characters?character=char-1",
      label: "Open character",
    });
    expect(
      toolNavigationTarget(
        "story-1",
        "get_story_entity",
        { kind: "place", entity_id: "place 1" },
        null,
      ),
    ).toEqual({
      to: "/create/story-1/places?place=place+1",
      label: "Open place",
    });
    expect(
      toolNavigationTarget(
        "story-1",
        "get_story_entity",
        { kind: "plot", entity_id: "plot-1" },
        null,
      ),
    ).toEqual({ to: "/create/story-1/plot", label: "Open plot" });
    expect(
      toolNavigationTarget(
        "story-1",
        "list_story_entities",
        { kind: "place" },
        null,
      ),
    ).toEqual({ to: "/create/story-1/places", label: "Open places" });
  });

  it("keeps semantic chunks and unknown tools non-clickable", () => {
    expect(
      toolNavigationTarget("story-1", "search_story", { query: "harbour" }, [
        { chunk_id: "chunk-1" },
      ]),
    ).toBeNull();
    expect(
      toolNavigationTarget("story-1", "future_read_tool", {}, {}),
    ).toBeNull();
  });

  it("allows only explicit secure web reference URLs", () => {
    expect(safeWebReferenceUrl("story", "https://example.com")).toBeNull();
    expect(safeWebReferenceUrl("web", "javascript:alert(1)")).toBeNull();
    expect(safeWebReferenceUrl("web", "https://example.com/source")).toBe(
      "https://example.com/source",
    );
  });
});
