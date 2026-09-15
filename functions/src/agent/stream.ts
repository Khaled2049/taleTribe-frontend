import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { Response } from "express";

const SAFE_UPSTREAM_ERRORS: Partial<Record<number, string>> = {
  403: "story_access_denied",
  409: "unsupported_protocol_version",
  429: "rate_limited",
};

/** Keep cancellation/deadline alive until the entire body has been forwarded. */
export async function relayAssistantStream(
  response: Response,
  open: (signal: AbortSignal) => Promise<globalThis.Response>,
  timeoutMs = 15_000,
): Promise<void> {
  if (response.destroyed || response.writableEnded) return;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  response.once("close", cancel);
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const upstream = await open(controller.signal);
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      const code = SAFE_UPSTREAM_ERRORS[upstream.status];
      response.status(code ? upstream.status : 502).json({
        error: { code: code ?? "provider_unavailable" },
      });
      return;
    }
    if (
      !upstream.headers.get("content-type")?.startsWith("text/event-stream")
    ) {
      await upstream.body.cancel();
      throw new Error("Unexpected stream format");
    }
    response.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders();
    await pipeline(
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]),
      response,
      { signal: controller.signal },
    );
  } catch {
    // Never log/return upstream bodies, tokens, prompts, or exception messages.
    if (!response.destroyed) {
      if (!response.headersSent) {
        response.status(502).json({ error: { code: "provider_unavailable" } });
      } else {
        response.end();
      }
    }
  } finally {
    controller.abort();
    clearTimeout(timer);
    response.off("close", cancel);
  }
}
