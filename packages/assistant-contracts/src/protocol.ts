/**
 * The browser half of the v1 run request.
 *
 * There is deliberately no `userId` here. The Functions gateway derives it from
 * the verified Firebase token and adds it before forwarding; a browser that
 * sends one is rejected by `extra="forbid"` on the Python side. Keeping the
 * field absent from this type means a caller cannot supply one by accident
 * either.
 *
 * `storyId` is top level rather than nested in `editorContext` because the
 * story is what the run is scoped to and what ownership is checked against —
 * and because `requireStoryOwnership` already reads `request.body.storyId`.
 */
import { z } from "zod";
import {
  ASSISTANT_PROTOCOL_VERSION,
  LIMITS,
  type RunContract,
  type RunRequest as GeneratedRunRequest,
} from "./generated/protocol";

export const selectionSchema = z
  .object({
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
    text: z.string().max(LIMITS.selectionChars),
  })
  .strict();

export const editorTextWindowSchema = z
  .object({
    text: z.string().max(LIMITS.editorWindowChars),
    truncated: z.boolean().default(false),
  })
  .strict();

export const replaceOperationSchema = z
  .object({
    type: z.literal("replace").default("replace"),
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
    originalText: z.string().min(1).max(LIMITS.selectionChars),
    replacementText: z.string().max(LIMITS.selectionChars).default(""),
  })
  .strict();

export const insertOperationSchema = z
  .object({
    type: z.literal("insert").default("insert"),
    at: z.number().int().nonnegative(),
    text: z.string().min(1).max(LIMITS.selectionChars),
  })
  .strict();

export const proposeEditorEditSchema = z
  .object({
    chapterId: z.string().min(1).max(LIMITS.idChars),
    baseRevision: z.number().int().nonnegative(),
    baseDocumentVersion: z.number().int().nonnegative(),
    summary: z.string().min(1).max(LIMITS.summaryChars),
    operations: z
      .array(
        z.discriminatedUnion("type", [
          replaceOperationSchema,
          insertOperationSchema,
        ]),
      )
      .min(1)
      .max(LIMITS.editOperations),
  })
  .strict();

export const editorApplyResultSchema = z
  .object({
    status: z.enum([
      "saved",
      "applied_local_save_failed",
      "applied_local_save_conflict",
      "stale",
      "invalid",
    ]),
    chapterId: z.string().min(1).max(LIMITS.idChars),
    documentVersion: z.number().int().nonnegative(),
    persistedRevision: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

export const editorContinuationSchema = z
  .object({
    kind: z.literal("editor_approval").default("editor_approval"),
    previousRunId: z.string().min(1).max(LIMITS.idChars),
    approvalId: z.string().min(1).max(LIMITS.idChars),
    toolCallId: z.string().min(1).max(LIMITS.idChars),
    proposalId: z.string().min(1).max(LIMITS.idChars),
    decision: z.enum([
      "applied",
      "rejected",
      "revision_requested",
      "apply_failed",
    ]),
    proposal: proposeEditorEditSchema,
    result: editorApplyResultSchema.nullable().optional(),
    feedback: z.string().min(1).max(LIMITS.summaryChars).nullable().optional(),
  })
  .strict();

export const editorContextSchema = z
  .object({
    chapterId: z.string().min(1).max(LIMITS.idChars).nullable().optional(),
    persistedRevision: z.number().int().nonnegative().nullable().optional(),
    documentVersion: z.number().int().nonnegative().nullable().optional(),
    selection: selectionSchema.nullable().optional(),
    buffer: editorTextWindowSchema.nullable().optional(),
    dirty: z.boolean().default(false),
  })
  .strict();

export const userMessageSchema = z
  .object({
    role: z.literal("user"),
    parts: z
      .array(
        z
          .object({
            type: z.literal("text"),
            text: z.string().min(1).max(LIMITS.messageChars),
          })
          .strict(),
      )
      .min(1)
      .max(LIMITS.partsPerMessage),
  })
  .strict();

export const runRequestSchema = z
  .object({
    v: z.literal(ASSISTANT_PROTOCOL_VERSION),
    storyId: z.string().min(1).max(LIMITS.idChars),
    threadId: z.string().min(1).max(LIMITS.idChars).nullable().optional(),
    clientMessageId: z.string().min(1).max(LIMITS.idChars),
    message: userMessageSchema,
    editorContext: editorContextSchema.nullable().optional(),
    continuation: editorContinuationSchema.nullable().optional(),
  })
  .strict();

export type Selection = z.infer<typeof selectionSchema>;
export type EditorContext = z.infer<typeof editorContextSchema>;
export type EditorTextWindow = z.infer<typeof editorTextWindowSchema>;
export type ReplaceOperation = z.infer<typeof replaceOperationSchema>;
export type ProposeEditorEditArgs = z.infer<typeof proposeEditorEditSchema>;
export type EditorApplyResult = z.infer<typeof editorApplyResultSchema>;
export type EditorContinuation = z.infer<typeof editorContinuationSchema>;
export type UserMessage = RunContract.UserMessage;
export type RunRequest = GeneratedRunRequest;

/** Builds a well-formed run request, so callers cannot forget `v`. */
export function buildRunRequest(input: {
  storyId: string;
  text: string;
  clientMessageId: string;
  threadId?: string;
  editorContext?: EditorContext;
  continuation?: EditorContinuation;
}): RunRequest {
  return runRequestSchema.parse({
    v: ASSISTANT_PROTOCOL_VERSION,
    storyId: input.storyId,
    threadId: input.threadId,
    clientMessageId: input.clientMessageId,
    message: { role: "user", parts: [{ type: "text", text: input.text }] },
    editorContext: input.editorContext,
    continuation: input.continuation,
  }) as RunRequest;
}
