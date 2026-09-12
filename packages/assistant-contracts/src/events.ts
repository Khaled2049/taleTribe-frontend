/**
 * The v1 assistant event union, as runtime schemas.
 *
 * Types and constants are generated from Python's exported JSON Schema. Zod is
 * deliberately hand-written for runtime validation, with all bounds imported
 * from that generated output so a Python limit change cannot silently drift.
 *
 * `z.object` strips unknown keys rather than rejecting them, which is exactly
 * the read half of the compatibility policy: a newer agent may add an optional
 * field without breaking this client. An unknown `type` still fails, because
 * the discriminated union has no branch for it.
 */
import { z } from "zod";
import {
  ASSISTANT_PROTOCOL_VERSION,
  ERROR_CODES,
  LIMITS,
  TERMINAL_EVENT_TYPES as GENERATED_TERMINAL_EVENT_TYPES,
  type AssistantEvent as GeneratedAssistantEvent,
  type EventContract,
} from "./generated/protocol";

export { ASSISTANT_PROTOCOL_VERSION, LIMITS };

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(LIMITS.contentChars),
});

export const toolCallPartSchema = z.object({
  type: z.literal("tool_call"),
  toolCallId: z.string().min(1).max(LIMITS.idChars),
  name: z.string().min(1).max(LIMITS.toolNameChars),
  arguments: z.record(z.string(), z.unknown()).default({}),
  result: z.unknown().optional(),
});

export const sourcePartSchema = z.object({
  type: z.literal("source"),
  sourceId: z.string().min(1).max(LIMITS.idChars),
  kind: z.enum(["story", "web"]),
  title: z.string().min(1).max(LIMITS.summaryChars),
  url: z.string().min(1).max(LIMITS.urlChars).nullable().optional(),
  snippet: z.string().min(1).max(LIMITS.messageChars).nullable().optional(),
});

export type TextPart = EventContract.TextPart;
export type ToolCallPart = EventContract.ToolCallPart;
export type SourcePart = EventContract.SourcePart;

const base = {
  v: z.literal(ASSISTANT_PROTOCOL_VERSION),
  runId: z.string().min(1).max(LIMITS.idChars),
  seq: z.number().int().nonnegative(),
};

export const assistantEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("run.started"),
    provider: z.string().min(1).max(LIMITS.toolNameChars).nullable().optional(),
    model: z.string().min(1).max(LIMITS.toolNameChars).nullable().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("text.delta"),
    text: z.string().min(1).max(LIMITS.contentChars),
  }),
  z.object({ ...base, type: z.literal("text.done"), part: textPartSchema }),
  z.object({
    ...base,
    type: z.literal("tool.started"),
    toolCallId: z.string().min(1).max(LIMITS.idChars),
    name: z.string().min(1).max(LIMITS.toolNameChars),
  }),
  z.object({
    ...base,
    type: z.literal("tool.args.delta"),
    toolCallId: z.string().min(1).max(LIMITS.idChars),
    delta: z.string().min(1).max(LIMITS.contentChars),
  }),
  z.object({
    ...base,
    type: z.literal("tool.completed"),
    part: toolCallPartSchema,
  }),
  z.object({
    ...base,
    type: z.literal("tool.failed"),
    toolCallId: z.string().min(1).max(LIMITS.idChars),
    code: errorCodeSchema,
    message: z.string().min(1).max(LIMITS.summaryChars),
  }),
  z.object({
    ...base,
    type: z.literal("approval.requested"),
    approvalId: z.string().min(1).max(LIMITS.idChars),
    toolCallId: z.string().min(1).max(LIMITS.idChars),
    summary: z.string().min(1).max(LIMITS.summaryChars),
  }),
  z.object({
    ...base,
    type: z.literal("approval.resolved"),
    approvalId: z.string().min(1).max(LIMITS.idChars),
    approved: z.boolean(),
  }),
  z.object({
    ...base,
    type: z.literal("reference.emitted"),
    part: sourcePartSchema,
  }),
  z.object({
    ...base,
    type: z.literal("usage"),
    provider: z.string().min(1).max(LIMITS.toolNameChars),
    model: z.string().min(1).max(LIMITS.toolNameChars),
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    credits: z.number().int().nonnegative(),
    billing: z.enum(["platform", "byok", "local", "mock"]),
  }),
  z.object({
    ...base,
    type: z.literal("run.completed"),
    finishReason: z.enum(["stop", "length", "tool_calls"]).default("stop"),
  }),
  z.object({
    ...base,
    type: z.literal("run.failed"),
    code: errorCodeSchema,
    message: z.string().min(1).max(LIMITS.summaryChars),
  }),
  z.object({ ...base, type: z.literal("run.cancelled") }),
]);

export type AssistantEvent = GeneratedAssistantEvent;
export type AssistantEventType = AssistantEvent["type"];

export const TERMINAL_EVENT_TYPES = GENERATED_TERMINAL_EVENT_TYPES;

export function isTerminal(event: AssistantEvent): boolean {
  return (TERMINAL_EVENT_TYPES as readonly string[]).includes(event.type);
}
