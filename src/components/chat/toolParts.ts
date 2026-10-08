import type { ThreadMessage } from "@assistant-ui/react";

export function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * The args of the propose call an apply part points at, unvalidated. The card
 * and the continuation both resolve the proposal here, so the one the writer
 * reviews is the one that is reported back.
 */
export function proposalArgs(
  content: ThreadMessage["content"],
  proposeTool: string,
  proposalId: unknown,
): unknown {
  const part = [...content]
    .reverse()
    .find(
      (candidate) =>
        candidate.type === "tool-call" &&
        candidate.toolName === proposeTool &&
        objectValue(candidate.result)?.proposalId === proposalId,
    );
  return part?.type === "tool-call" ? part.args : null;
}
