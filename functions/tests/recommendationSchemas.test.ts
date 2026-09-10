import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendationSchemas } from "../src/endpoints/recommendations";

describe("recommendation request validation", () => {
  it("accepts a natural-language discovery request", () => {
    const result = recommendationSchemas.recommendationSchema.safeParse({
      mode: "adhoc",
      prompt: "a quiet mystery set beside the sea",
      topK: 12,
      filters: { genres: ["mystery-thriller"] },
    });

    assert.equal(result.success, true);
  });

  it("requires a prompt or story seed for ad-hoc discovery", () => {
    const result = recommendationSchemas.recommendationSchema.safeParse({
      mode: "adhoc",
    });

    assert.equal(result.success, false);
  });

  it("rejects a browser-supplied user id", () => {
    const result = recommendationSchemas.recommendationSchema.safeParse({
      mode: "behavioral",
      user_id: "spoofed-reader",
    });

    assert.equal(result.success, false);
  });

  it("caps explanation batches", () => {
    const result = recommendationSchemas.explanationSchema.safeParse({
      itemIds: Array.from({ length: 26 }, (_, index) => index + 1),
    });

    assert.equal(result.success, false);
  });
});
