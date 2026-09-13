import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Request, Response } from "express";
import { handleAssistantRun } from "../src/endpoints/assistantRun";

test("continuations are rejected at the gateway when edit proposals are off", async () => {
  const priorApi = process.env.ASSISTANT_API_ENABLED;
  const priorEdits = process.env.ASSISTANT_EDIT_PROPOSALS_ENABLED;
  process.env.ASSISTANT_API_ENABLED = "true";
  delete process.env.ASSISTANT_EDIT_PROPOSALS_ENABLED;
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
