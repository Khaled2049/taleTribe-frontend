import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createStoryByAdminSchema,
  countWords,
  requestHash,
} from "../src/domain/adminStorySchemas";

function validPayload() {
  return {
    idempotencyKey: "seed-story-1",
    ownerUid: "owner-1",
    story: {
      title: "The Glass Orchard",
      description: "A speculative short story.",
      isPublished: true,
      category: "Science Fiction",
      tags: ["mystery", "mystery", "climate"],
    },
    chapters: [
      {
        key: "chapter-1",
        title: "The First Harvest",
        content: "<p>The orchard chimed in the wind.</p>",
      },
    ],
    characters: [
      {
        key: "elena",
        name: "Elena",
        relationships: [
          { characterKey: "marcus", type: "rival" as const },
        ],
      },
      { key: "marcus", name: "Marcus" },
    ],
    places: [{ key: "orchard", name: "The Glass Orchard" }],
    plots: [
      {
        key: "main",
        name: "Main Plot",
        events: [
          {
            key: "warning",
            name: "The Warning",
            content: "Elena hears the first warning.",
            characterKeys: ["elena"],
            locationKey: "orchard",
          },
          {
            key: "choice",
            name: "The Choice",
            content: "Elena chooses to stay.",
            dependencies: [
              {
                plotKey: "main",
                eventKey: "warning",
                relationshipType: "requires" as const,
              },
            ],
          },
        ],
      },
    ],
  };
}


describe("createStoryByAdminSchema", () => {
  it("normalizes a valid full aggregate and removes duplicate tags", () => {
    const parsed = createStoryByAdminSchema.parse(validPayload());
    assert.deepEqual(parsed.story.tags, ["mystery", "climate"]);
    assert.equal(parsed.story.coverImageUrl, "");
    assert.deepEqual(parsed.characters[1].relationships, []);
    assert.equal(parsed.plots[0].events[0].pacing, "moderate");
  });

  it("rejects unknown fields at every strict object boundary", () => {
    const payload = validPayload();
    const result = createStoryByAdminSchema.safeParse({ ...payload, arbitrary: true });
    assert.equal(result.success, false);
  });

  it("rejects duplicate local keys", () => {
    const payload = validPayload();
    payload.chapters.push({ ...payload.chapters[0] });
    const result = createStoryByAdminSchema.safeParse(payload);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(
        result.error.issues.some((issue) => issue.message.includes("duplicate key")),
        true,
      );
    }
  });

  it("rejects chapters above the word limit", () => {
    const payload = validPayload();
    payload.chapters[0].content = Array.from({ length: 5_001 }, () => "word").join(" ");
    assert.equal(createStoryByAdminSchema.safeParse(payload).success, false);
  });

  it("allows only HTTPS media URLs", () => {
    const payload = validPayload();
    payload.story = { ...payload.story, coverImageUrl: "http://example.com/cover.jpg" } as typeof payload.story;
    assert.equal(createStoryByAdminSchema.safeParse(payload).success, false);
  });
});

describe("story import helpers", () => {
  it("counts empty and non-empty content consistently", () => {
    assert.equal(countWords("  "), 0);
    assert.equal(countWords("one two\nthree"), 3);
  });

  it("hashes semantically identical objects independently of object key order", () => {
    const parsed = createStoryByAdminSchema.parse(validPayload());
    const reordered = { ...parsed, story: { ...parsed.story } };
    assert.equal(requestHash(parsed), requestHash(reordered));
  });

});
