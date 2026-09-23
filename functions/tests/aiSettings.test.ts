import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalProvider } from "../src/domain/aiSettings";

describe("canonicalProvider", () => {
  it("preserves supported providers and migrates the legacy Claude alias", () => {
    assert.equal(canonicalProvider("gemini"), "gemini");
    assert.equal(canonicalProvider("openai"), "openai");
    assert.equal(canonicalProvider("anthropic"), "anthropic");
    assert.equal(canonicalProvider("claude"), "anthropic");
  });

  it("fails closed for missing or unsupported stored providers", () => {
    assert.equal(canonicalProvider(undefined), null);
    assert.equal(canonicalProvider(null), null);
    assert.equal(canonicalProvider("cohere"), null);
    assert.equal(canonicalProvider("openai "), null);
  });
});
