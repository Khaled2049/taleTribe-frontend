import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import type { Response } from "express";
import { relayAssistantStream } from "../src/agent/stream";

test("gateway forwards first bytes before completion and propagates disconnect", async () => {
  let upstreamSignal: AbortSignal | undefined;
  let finished!: () => void;
  const relayed = new Promise<void>((resolve) => {
    finished = resolve;
  });
  const server = createServer((_, raw) => {
    const res = raw as unknown as Response;
    res.status = (code: number) => {
      raw.statusCode = code;
      return res;
    };
    res.set = ((headers: Record<string, string>) => {
      for (const [key, value] of Object.entries(headers)) {
        raw.setHeader(key, value);
      }
      return res;
    }) as Response["set"];
    void relayAssistantStream(res, async (signal) => {
      upstreamSignal = signal;
      return new globalThis.Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                "data: " +
                  JSON.stringify({ type: "text-delta", text: "first" }) +
                  "\n\n",
              ),
            );
            // Deliberately never close: reading this frame proves no body buffering.
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }).finally(finished);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as { port: number };
    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      signal: controller.signal,
    });
    assert.ok(response.body);
    const reader = response.body.getReader();
    const first = await reader.read();
    assert.match(new TextDecoder().decode(first.value), /first/);
    assert.equal(upstreamSignal?.aborted, false);
    controller.abort();
    await relayed;
    assert.equal(upstreamSignal?.aborted, true);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("gateway preserves an unsupported-version conflict with a safe code", async () => {
  let finished!: () => void;
  const relayed = new Promise<void>((resolve) => {
    finished = resolve;
  });
  const server = createServer((_, raw) => {
    const res = raw as unknown as Response;
    res.status = (code: number) => {
      raw.statusCode = code;
      return res;
    };
    res.json = ((body: unknown) => {
      raw.setHeader("Content-Type", "application/json");
      raw.end(JSON.stringify(body));
      return res;
    }) as Response["json"];
    void relayAssistantStream(
      res,
      async () =>
        new globalThis.Response("provider body must not cross the gateway", {
          status: 409,
        }),
    ).finally(finished);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}`);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: { code: "unsupported_protocol_version" },
    });
    await relayed;
  } finally {
    server.closeAllConnections();
    server.close();
  }
});
