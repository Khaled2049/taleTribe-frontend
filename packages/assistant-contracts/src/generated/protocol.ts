// Generated from schema/v1.json. Do not edit by hand.

export namespace RunContract {
  export type V = 1
  export type Storyid = string
  export type Threadid = (string | null)
  export type Clientmessageid = string
  export type Role = "user"
  /**
   * @minItems 1
   * @maxItems 16
   */
  export type Parts = [UserTextPart]|[UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]|[UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart, UserTextPart]
  export type Type = "text"
  export type Text = string
  export type Chapterid = (string | null)
  export type Persistedrevision = (number | null)
  export type Documentversion = (number | null)
  export type From = number
  export type To = number
  export type Text1 = string
  export type Text2 = string
  export type Truncated = boolean
  export type Dirty = boolean
  export type Kind = "editor_approval"
  export type Previousrunid = string
  export type Approvalid = string
  export type Toolcallid = string
  export type Proposalid = string
  export type Decision = ("applied" | "rejected" | "revision_requested" | "apply_failed")
  export type Chapterid1 = string
  export type Baserevision = number
  export type Basedocumentversion = number
  export type Summary = string
  /**
   * @minItems 1
   * @maxItems 20
   */
  export type Operations = [(ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]|[(ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation), (ReplaceOperation | InsertOperation)]
  export type Type1 = "replace"
  export type From1 = number
  export type To1 = number
  export type Originaltext = string
  export type Replacementtext = string
  export type Type2 = "insert"
  export type At = number
  export type Text3 = string
  export type Status = ("saved" | "applied_local_save_failed" | "applied_local_save_conflict" | "stale" | "invalid")
  export type Chapterid2 = string
  export type Documentversion1 = number
  export type Persistedrevision1 = (number | null)
  export type Feedback = (string | null)

  /**
   * What the browser sends. Carries no identity -- see the module docstring.
   */
  export interface RunRequest {
  v: V
  storyId: Storyid
  threadId?: Threadid
  clientMessageId: Clientmessageid
  message: UserMessage
  editorContext?: (EditorContext | null)
  continuation?: (EditorContinuation | null)
  }
  /**
   * v1 user input is text-only; the list is for forward room, not features.
   */
  export interface UserMessage {
  role: Role
  parts: Parts
  }
  /**
   * The same wire shape, bounded far tighter.
   *
   * Input crosses a trust boundary and costs prompt tokens, so it is capped at
   * ``MAX_MESSAGE_CHARS`` rather than the ``MAX_CONTENT_CHARS`` an assistant
   * reply may reach. Same ``type`` tag, because to a renderer it is the same
   * thing.
   */
  export interface UserTextPart {
  type: Type
  text: Text
  }
  /**
   * Freshness for the active buffer. Optional, and unused until Phase 5.
   *
   * Specified now so Phase 5 does not need a protocol change. Deliberately not a
   * place to put the manuscript: send the selection and the minimum context
   * needed for freshness, and let the server retrieve persisted story text.
   */
  export interface EditorContext {
  chapterId?: Chapterid
  persistedRevision?: Persistedrevision
  documentVersion?: Documentversion
  selection?: (Selection | null)
  buffer?: (EditorTextWindow | null)
  dirty?: Dirty
  }
  export interface Selection {
  from: From
  to: To
  text: Text1
  }
  /**
   * A bounded plain-text view of the live editor, never HTML or TipTap JSON.
   */
  export interface EditorTextWindow {
  text: Text2
  truncated?: Truncated
  }
  /**
   * Stateless second request after a browser-owned approval decision.
   */
  export interface EditorContinuation {
  kind?: Kind
  previousRunId: Previousrunid
  approvalId: Approvalid
  toolCallId: Toolcallid
  proposalId: Proposalid
  decision: Decision
  proposal: ProposeEditorEditArgs
  result?: (EditorApplyResult | null)
  feedback?: Feedback
  }
  export interface ProposeEditorEditArgs {
  chapterId: Chapterid1
  baseRevision: Baserevision
  baseDocumentVersion: Basedocumentversion
  summary: Summary
  operations: Operations
  }
  /**
   * The Phase 5 editor operation. An empty replacement is a deletion.
   */
  export interface ReplaceOperation {
  type?: Type1
  from: From1
  to: To1
  originalText: Originaltext
  replacementText?: Replacementtext
  }
  /**
   * Reserved for a later editor phase; Phase 5 rejects it at execution.
   */
  export interface InsertOperation {
  type?: Type2
  at: At
  text: Text3
  }
  /**
   * Bounded browser report. It never authorizes or performs a server write.
   */
  export interface EditorApplyResult {
  status: Status
  chapterId: Chapterid2
  documentVersion: Documentversion1
  persistedRevision?: Persistedrevision1
  }
}
export type RunRequest = RunContract.RunRequest;

export namespace EventContract {
  export type AssistantEvent = (RunStarted | TextDelta | TextDone | ToolStarted | ToolArgsDelta | ToolCompleted | ToolFailed | ApprovalRequested | ApprovalResolved | ReferenceEmitted | Usage | RunCompleted | RunFailed | RunCancelled)
  export type V = 1
  export type Runid = string
  export type Seq = number
  export type Type = "run.started"
  export type Provider = (string | null)
  export type Model = (string | null)
  export type V1 = 1
  export type Runid1 = string
  export type Seq1 = number
  export type Type1 = "text.delta"
  export type Text = string
  export type V2 = 1
  export type Runid2 = string
  export type Seq2 = number
  export type Type2 = "text.done"
  export type Type3 = "text"
  export type Text1 = string
  export type V3 = 1
  export type Runid3 = string
  export type Seq3 = number
  export type Type4 = "tool.started"
  export type Toolcallid = string
  export type Name = string
  export type V4 = 1
  export type Runid4 = string
  export type Seq4 = number
  export type Type5 = "tool.args.delta"
  export type Toolcallid1 = string
  export type Delta = string
  export type V5 = 1
  export type Runid5 = string
  export type Seq5 = number
  export type Type6 = "tool.completed"
  export type Type7 = "tool_call"
  export type Toolcallid2 = string
  export type Name1 = string
  export type V6 = 1
  export type Runid6 = string
  export type Seq6 = number
  export type Type8 = "tool.failed"
  export type Toolcallid3 = string
  export type ErrorCode = ("unsupported_protocol_version" | "story_access_denied" | "quota_exceeded" | "rate_limited" | "provider_unavailable" | "provider_error" | "run_cancelled" | "stale_proposal" | "internal_error")
  export type Message = string
  export type V7 = 1
  export type Runid7 = string
  export type Seq7 = number
  export type Type9 = "approval.requested"
  export type Approvalid = string
  export type Toolcallid4 = string
  export type Summary = string
  export type V8 = 1
  export type Runid8 = string
  export type Seq8 = number
  export type Type10 = "approval.resolved"
  export type Approvalid1 = string
  export type Approved = boolean
  export type V9 = 1
  export type Runid9 = string
  export type Seq9 = number
  export type Type11 = "reference.emitted"
  export type Type12 = "source"
  export type Sourceid = string
  export type Kind = ("story" | "web")
  export type Title = string
  export type Url = (string | null)
  export type Snippet = (string | null)
  export type V10 = 1
  export type Runid10 = string
  export type Seq10 = number
  export type Type13 = "usage"
  export type Provider1 = string
  export type Model1 = string
  export type Prompttokens = number
  export type Completiontokens = number
  export type Credits = number
  export type Billing = ("platform" | "byok" | "local" | "mock")
  export type V11 = 1
  export type Runid11 = string
  export type Seq11 = number
  export type Type14 = "run.completed"
  export type Finishreason = ("stop" | "length" | "tool_calls" | "max_steps")
  export type V12 = 1
  export type Runid12 = string
  export type Seq12 = number
  export type Type15 = "run.failed"
  export type Message1 = string
  export type V13 = 1
  export type Runid13 = string
  export type Seq13 = number
  export type Type16 = "run.cancelled"

  export interface RunStarted {
  v: V
  runId: Runid
  seq: Seq
  type: Type
  provider?: Provider
  model?: Model
  }
  /**
   * Incremental. The frontend accumulates; deltas are not cumulative.
   */
  export interface TextDelta {
  v: V1
  runId: Runid1
  seq: Seq1
  type: Type1
  text: Text
  }
  /**
   * The settled text part, so a reload never depends on replaying deltas.
   */
  export interface TextDone {
  v: V2
  runId: Runid2
  seq: Seq2
  type: Type2
  part: TextPart
  }
  /**
   * Assistant-produced text, and the persisted form of a settled reply.
   */
  export interface TextPart {
  type: Type3
  text: Text1
  }
  export interface ToolStarted {
  v: V3
  runId: Runid3
  seq: Seq3
  type: Type4
  toolCallId: Toolcallid
  name: Name
  }
  export interface ToolArgsDelta {
  v: V4
  runId: Runid4
  seq: Seq4
  type: Type5
  toolCallId: Toolcallid1
  delta: Delta
  }
  export interface ToolCompleted {
  v: V5
  runId: Runid5
  seq: Seq5
  type: Type6
  part: ToolCallPart
  }
  /**
   * A completed tool round, in the shape the UI reloads it from.
   */
  export interface ToolCallPart {
  type: Type7
  toolCallId: Toolcallid2
  name: Name1
  arguments?: Arguments
  result?: any
  }
  export interface Arguments {
  [k: string]: any
  }
  export interface ToolFailed {
  v: V6
  runId: Runid6
  seq: Seq6
  type: Type8
  toolCallId: Toolcallid3
  code: ErrorCode
  message: Message
  }
  /**
   * Reserved. No v1 tool requires approval until Phase 5 adds editor writes.
   */
  export interface ApprovalRequested {
  v: V7
  runId: Runid7
  seq: Seq7
  type: Type9
  approvalId: Approvalid
  toolCallId: Toolcallid4
  summary: Summary
  }
  export interface ApprovalResolved {
  v: V8
  runId: Runid8
  seq: Seq8
  type: Type10
  approvalId: Approvalid1
  approved: Approved
  }
  export interface ReferenceEmitted {
  v: V9
  runId: Runid9
  seq: Seq9
  type: Type11
  part: SourcePart
  }
  /**
   * A story or web reference. ``url`` is absent for story-internal sources.
   */
  export interface SourcePart {
  type: Type12
  sourceId: Sourceid
  kind: Kind
  title: Title
  url?: Url
  snippet?: Snippet
  }
  export interface Usage {
  v: V10
  runId: Runid10
  seq: Seq10
  type: Type13
  provider: Provider1
  model: Model1
  promptTokens: Prompttokens
  completionTokens: Completiontokens
  credits: Credits
  billing: Billing
  }
  /**
   * Terminal success. ``finishReason`` says *why* the run stopped talking.
   *
   * ``max_steps`` is the orchestrator's own ceiling, and it is a success rather
   * than a failure: the user has a real partial answer, so ``run.failed`` would
   * both discard it and render a message about a daily allowance that was never
   * reached. ``stop`` would be a lie in the other direction -- it claims the
   * model was finished -- and Phase 4 needs to tell the two apart to offer
   * "continue".
   */
  export interface RunCompleted {
  v: V11
  runId: Runid11
  seq: Seq11
  type: Type14
  finishReason?: Finishreason
  }
  export interface RunFailed {
  v: V12
  runId: Runid12
  seq: Seq12
  type: Type15
  code: ErrorCode
  message: Message1
  }
  export interface RunCancelled {
  v: V13
  runId: Runid13
  seq: Seq13
  type: Type16
  }
}
export type AssistantEvent = EventContract.AssistantEvent;

export const ASSISTANT_PROTOCOL_VERSION = 1 as const;
export const ERROR_CODES = ["unsupported_protocol_version","story_access_denied","quota_exceeded","rate_limited","provider_unavailable","provider_error","run_cancelled","stale_proposal","internal_error"] as const;
export const TERMINAL_EVENT_TYPES = ["run.cancelled","run.completed","run.failed"] as const;
export const APPROVAL_REQUIRED_TOOLS = ["apply_editor_edit"] as const;
export const LIMITS = {
  "contentChars": 100000,
  "idChars": 128,
  "messageChars": 10000,
  "partsPerMessage": 16,
  "selectionChars": 10000,
  "editorWindowChars": 8000,
  "summaryChars": 500,
  "toolNameChars": 64,
  "urlChars": 2048,
  "queryChars": 500,
  "toolResults": 20,
  "chapterWindowChars": 20000,
  "editOperations": 20,
  "researchResults": 5
} as const;
