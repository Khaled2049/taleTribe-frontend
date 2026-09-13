import { describe, expect, it } from "vitest";
import type { ThreadMessage } from "@assistant-ui/react";
import { editorContinuationForMessage } from "@/components/chat/assistantRuntime";
import { EditorActionLedger } from "@/components/chat/editorActionLedger";

const proposal = {
  chapterId: "chapter-1",
  baseRevision: 3,
  baseDocumentVersion: 7,
  summary: "Tighten the image",
  operations: [
    {
      type: "replace",
      from: 1,
      to: 6,
      originalText: "Hello",
      replacementText: "Hail",
    },
  ],
};

function pausedMessage(): ThreadMessage {
  return {
    role: "assistant",
    status: { type: "requires-action", reason: "tool-calls" },
    content: [
      {
        type: "tool-call",
        toolCallId: "proposal-call",
        toolName: "propose_editor_edit",
        args: proposal,
        argsText: JSON.stringify(proposal),
        result: { proposalId: "proposal-1" },
      },
      {
        type: "tool-call",
        toolCallId: "apply-1",
        toolName: "apply_editor_edit",
        args: { proposalId: "proposal-1" },
        argsText: '{"proposalId":"proposal-1"}',
        approval: {
          id: "approval-1",
          approved: true,
        },
      },
    ],
    metadata: {
      custom: { novelsync: { runId: "run-1" } },
    },
  } as unknown as ThreadMessage;
}

describe("assistant approval continuation", () => {
  it("links the exact proposal, approval, prior run, and local save result", () => {
    const ledger = new EditorActionLedger();
    ledger.resolve("approval-1", {
      decision: "applied",
      result: {
        status: "saved",
        chapterId: "chapter-1",
        documentVersion: 8,
        persistedRevision: 4,
      },
    });

    expect(editorContinuationForMessage(pausedMessage(), ledger)).toMatchObject(
      {
        previousRunId: "run-1",
        proposalId: "proposal-1",
        approvalId: "approval-1",
        toolCallId: "apply-1",
        decision: "applied",
        proposal,
        result: { status: "saved" },
      },
    );
  });

  it("fails closed when a resolved approval has no browser action result", () => {
    expect(() =>
      editorContinuationForMessage(pausedMessage(), new EditorActionLedger()),
    ).toThrow(/could not be resumed safely/);
  });
});
