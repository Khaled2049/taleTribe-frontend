import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import { onRequest } from "firebase-functions/v2/https";
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

  it("enforces exact production origins through the Functions HTTP wrapper", async () => {
    const app = express();
    const handler = onRequest(
      { cors: getAllowedOrigins({}) },
      (_request, response) => {
        response.status(200).json({ ok: true });
      },
    );
    app.use((request, response) => {
      void handler(request as Parameters<typeof handler>[0], response);
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    try {
      for (const origin of [
        "tauri://localhost",
        "tauri://other-host",
        "null",
        "https://evil.example",
      ]) {
        const response: Awaited<ReturnType<typeof fetch>> = await fetch(
          `http://127.0.0.1:${address.port}`,
          {
            method: "OPTIONS",
            headers: {
              Origin: origin,
              "Access-Control-Request-Method": "POST",
            },
          },
        );
        assert.equal(
          response.headers.get("access-control-allow-origin"),
          origin === "tauri://localhost" ? origin : null,
        );
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
