import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Request, Response } from "express";
import {
  assistantRunConsumesQuota,
  buildRunRequest,
  handleAssistantRun,
} from "../src/endpoints/assistantRun";

test("only no-model continuations skip daily quota", () => {
  for (const decision of ["applied", "rejected", "apply_failed"]) {
    assert.equal(
      assistantRunConsumesQuota({ continuation: { decision } }),
      false,
      `${decision} should not consume quota`,
    );
  }

  for (const body of [
    undefined,
    {},
    { continuation: null },
    { continuation: {} },
    { continuation: { decision: "revision_requested" } },
    { continuation: { decision: "fabricated" } },
  ]) {
    assert.equal(
      assistantRunConsumesQuota(body),
      true,
      `${JSON.stringify(body)} should consume quota`,
    );
  }
});

test("continuations are rejected at the gateway when edit proposals are off", async () => {
  const priorApi = process.env.ASSISTANT_API_ENABLED;
  const priorEdits = process.env.ASSISTANT_EDIT_PROPOSALS_ENABLED;
  process.env.ASSISTANT_API_ENABLED = "true";
  process.env.ASSISTANT_EDIT_PROPOSALS_ENABLED = "false";
  let status = 0;
  let payload: unknown;
  const response = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;

  try {
    await handleAssistantRun(
      {
        method: "POST",
        body: { storyId: "story-1", continuation: { kind: "editor_approval" } },
      } as Request,
      response,
    );
  } finally {
    if (priorApi === undefined) delete process.env.ASSISTANT_API_ENABLED;
    else process.env.ASSISTANT_API_ENABLED = priorApi;
    if (priorEdits === undefined) {
      delete process.env.ASSISTANT_EDIT_PROPOSALS_ENABLED;
    } else {
      process.env.ASSISTANT_EDIT_PROPOSALS_ENABLED = priorEdits;
    }
  }

  assert.equal(status, 404);
  assert.deepEqual(payload, { error: "Assistant edits are disabled" });
});

test("a browser cannot supply its own identity, story, or provider key", () => {
  const built = buildRunRequest(
    {
      v: 1,
      storyId: "someone-elses-story",
      userId: "someone-else",
      provider_config: {
        provider: "openai",
        api_key: "sk-attacker-supplied",
      },
      message: { role: "user", parts: [{ type: "text", text: "hi" }] },
    },
    { storyId: "story-1", userId: "user-1", providerConfig: null },
  );

  assert.equal(built.storyId, "story-1");
  assert.equal(built.userId, "user-1");
  // Not merely overridden with another key — absent, so the run bills the
  // platform rather than dialling a provider the browser chose.
  assert.equal(built.provider_config, undefined);
  // Everything the browser legitimately owns still passes through.
  assert.deepEqual(built.message, {
    role: "user",
    parts: [{ type: "text", text: "hi" }],
  });
});

test("resolved BYOK credentials reach the agent", () => {
  const built = buildRunRequest(
    { v: 1, message: { role: "user", parts: [{ type: "text", text: "hi" }] } },
    {
      storyId: "story-1",
      userId: "user-1",
      providerConfig: {
        provider: "gemini",
        api_key: "user-key",
        model: "gemini-2.5-flash",
      },
    },
  );

  assert.deepEqual(built.provider_config, {
    provider: "gemini",
    api_key: "user-key",
    model: "gemini-2.5-flash",
  });
});

test("a missing or malformed body still yields a pinned request", () => {
  for (const body of [undefined, null, "not-an-object", 42]) {
    const built = buildRunRequest(body, {
      storyId: "story-1",
      userId: "user-1",
      providerConfig: null,
    });
    assert.equal(built.storyId, "story-1");
    assert.equal(built.userId, "user-1");
  }
});
