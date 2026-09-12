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

export const editorContextSchema = z
  .object({
    chapterId: z.string().min(1).max(LIMITS.idChars).nullable().optional(),
    persistedRevision: z.number().int().nonnegative().nullable().optional(),
    documentVersion: z.number().int().nonnegative().nullable().optional(),
    selection: selectionSchema.nullable().optional(),
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
  })
  .strict();

export type Selection = RunContract.Selection;
export type EditorContext = RunContract.EditorContext;
export type UserMessage = RunContract.UserMessage;
export type RunRequest = GeneratedRunRequest;

/** Builds a well-formed run request, so callers cannot forget `v`. */
export function buildRunRequest(input: {
  storyId: string;
  text: string;
  clientMessageId: string;
  threadId?: string;
  editorContext?: EditorContext;
}): RunRequest {
  return runRequestSchema.parse({
    v: ASSISTANT_PROTOCOL_VERSION,
    storyId: input.storyId,
    threadId: input.threadId,
    clientMessageId: input.clientMessageId,
    message: { role: "user", parts: [{ type: "text", text: input.text }] },
    editorContext: input.editorContext,
  }) as RunRequest;
}
