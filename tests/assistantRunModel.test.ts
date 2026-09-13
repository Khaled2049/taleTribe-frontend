import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyEvent,
  assistantEventSchema,
  emptyRunState,
  type RunState,
} from "@novelsync/assistant-contracts";
import {
  assistantFailureForStatus,
  toAssistantRunResult,
} from "@/components/chat/assistantRunModel";

function projectedFixture(name: string): RunState {
  const fixture = JSON.parse(
    readFileSync(
      path.resolve(
        __dirname,
        `../packages/assistant-contracts/fixtures/${name}.json`,
      ),
      "utf8",
    ),
  ) as { events: unknown[] };
  let state = emptyRunState();
  for (const event of fixture.events) {
    state = applyEvent(state, assistantEventSchema.parse(event));
  }
  return state;
}

describe("assistant-ui run conversion", () => {
  it("converts tools, text, sources, usage, and completion metadata", () => {
    const state = projectedFixture("research-citations");
    const result = toAssistantRunResult(state);

    expect(result.status).toEqual({ type: "complete", reason: "stop" });
    expect(result.content?.map((part) => part.type)).toEqual([
      "tool-call",
      "text",
      "source",
      "source",
    ]);
    expect(result.content?.[0]).toMatchObject({
      type: "tool-call",
      toolCallId: "call-1",
      toolName: "research_web",
      isError: false,
    });
    expect(result.content?.[2]).toMatchObject({
      type: "source",
      sourceType: "document",
      title: "Fresnel lens",
      providerMetadata: {
        novelsync: { kind: "web", snippet: expect.any(String) },
      },
    });
    expect(result.metadata?.custom?.novelsync).toMatchObject({
      usage: { promptTokens: 1220, completionTokens: 11, credits: 13 },
      finishReason: "stop",
    });
  });

  it("maps max-steps and output-length terminals without dropping partial text", () => {
    const maxSteps = toAssistantRunResult(projectedFixture("max-steps"));
    expect(maxSteps.status).toEqual({ type: "incomplete", reason: "other" });
    expect(maxSteps.content).toContainEqual(
      expect.objectContaining({
        type: "text",
        text: "The keeper appears in chapter two",
      }),
    );
    expect(maxSteps.metadata?.custom?.novelsync).toMatchObject({
      usage: {
        promptTokens: 1550,
        completionTokens: 20,
        credits: 17,
        modelCalls: 2,
      },
      finishReason: "max_steps",
      notice: expect.stringContaining("Stopped early"),
    });

    let length = emptyRunState();
    [
      { type: "text.delta", text: "An unfinished answer" },
      { type: "run.completed", finishReason: "length" },
    ].forEach((event, seq) => {
      length = applyEvent(
        length,
        assistantEventSchema.parse({ v: 1, runId: "length", seq, ...event }),
      );
    });
    expect(toAssistantRunResult(length).status).toEqual({
      type: "incomplete",
      reason: "length",
    });
  });

  it("maps tool and run failures to display-only safe records", () => {
    const stale = toAssistantRunResult(projectedFixture("stale-edit"));
    expect(stale.content?.[0]).toMatchObject({
      type: "tool-call",
      isError: true,
      result: { code: "stale_proposal" },
    });

    const provider = toAssistantRunResult(projectedFixture("provider-error"));
    expect(provider.status).toMatchObject({
      type: "incomplete",
      reason: "error",
    });
    expect(provider.metadata?.custom?.novelsync).toMatchObject({
      failure: { code: "provider_unavailable" },
    });
  });

  it("keeps cancellation distinct from provider errors", () => {
    const result = toAssistantRunResult(projectedFixture("cancellation"));
    expect(result.status).toEqual({ type: "incomplete", reason: "cancelled" });
    expect(result.metadata?.custom?.novelsync).toMatchObject({
      failure: null,
      notice: expect.stringContaining("Stopped"),
    });

    const localAbort = toAssistantRunResult(emptyRunState(), {
      cancelled: true,
    });
    expect(localAbort.metadata?.custom?.novelsync).toMatchObject({
      finishReason: "run.cancelled",
      failure: null,
    });
  });

  it("fails closed when an approval capability appears", () => {
    const result = toAssistantRunResult(
      projectedFixture("approval-pause-resume"),
    );
    expect(result.status).toMatchObject({
      type: "incomplete",
      reason: "error",
    });
    expect(result.metadata?.custom?.novelsync).toMatchObject({
      failure: {
        code: "unsupported_capability",
        message: expect.stringContaining("Nothing was changed"),
      },
    });
  });

  it("classifies quota, rate, protocol, access, and provider HTTP failures", () => {
    expect(assistantFailureForStatus(402).code).toBe("quota_exceeded");
    expect(assistantFailureForStatus(429).code).toBe("rate_limited");
    expect(assistantFailureForStatus(409).code).toBe(
      "unsupported_protocol_version",
    );
    expect(assistantFailureForStatus(403).code).toBe("story_access_denied");
    expect(assistantFailureForStatus(503).code).toBe("provider_unavailable");
  });
});
