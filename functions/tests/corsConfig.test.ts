import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAllowedOrigins } from "../src/infra/corsConfig";

describe("reader CORS allowlist", () => {
  it("allows the bundled iOS origin without granting arbitrary or opaque origins", () => {
    const origins = getAllowedOrigins({});
    assert.ok(origins.includes("tauri://localhost"));
    for (const origin of [
      "null",
      "tauri://other-host",
      "https://evil.example",
      "http://localhost:5174",
      "*",
    ]) {
      assert.ok(!origins.includes(origin));
    }
  });
  it("allows standalone mobile dev servers only in the emulator", () => {
    const origins = getAllowedOrigins({ FUNCTIONS_EMULATOR: "true" });
    assert.ok(origins.includes("http://localhost:5174"));
    assert.ok(origins.includes("http://127.0.0.1:5174"));
  });
});
