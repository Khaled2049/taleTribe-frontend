import assert from "node:assert/strict";
import { test } from "node:test";
import { isStoryOwner } from "../src/infra/storyOwnership";

test("the owner of a story passes", () => {
  assert.equal(isStoryOwner({ id: "s1", ownerId: "alice", isPublished: false }, "alice"), true);
});

test("a published story someone else owns does not pass", () => {
  // story-data returns this body with a 200 to any signed-in reader.
  assert.equal(isStoryOwner({ id: "s1", ownerId: "alice", isPublished: true }, "bob"), false);
});

test("a body without an owner never passes", () => {
  for (const body of [null, undefined, "alice", [], {}, { ownerId: null }, { ownerId: "" }]) {
    assert.equal(isStoryOwner(body, "alice"), false);
    assert.equal(isStoryOwner(body, ""), false);
  }
});
