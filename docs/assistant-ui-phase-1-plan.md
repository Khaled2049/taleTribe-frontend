# Assistant Phase 1 implementation plan: versioned contracts

Date: 2026-09-11. Completed: 2026-09-12. Status: complete. Scope: P1-T0 through P1-T4 of
[the integration plan](assistant-ui-integration.md#phase-1--versioned-assistant-contracts).
Predecessor: [Phase 0](assistant-ui-phase-0.md).

Phase 1 is a schema phase. No agent loop, no model call, no UI work, no
persistence. The deliverable is a protocol that frontend, agents and creditProxy
can build against in parallel without guessing each other's shapes.

## Completion record

- The Pydantic assistant protocol, event union, safe error codes, bounded tool
  schemas, schema exporter and canonical fixtures are implemented in
  `taleTribe-agents`.
- The frontend consumes the vendored schema through generated TypeScript and
  validates stream events at runtime with Zod. CI checks generated output and
  fixture hashes for drift.
- `creditProxy` owns the separate provider-neutral chat contract, OpenAPI
  descriptions and model-contract fixtures. No chat handler was added.
- The Phase 0 spike now emits and consumes v1 events. Its existing targeted
  Cypress smoke passed; no broader integration suite was added for this schema
  phase.

## Scope adjustment: no production users

This plan deliberately narrows the Phase 1 description because the platform has
no production users and no deployed assistant surface. The reductions:

- **One protocol version.** `v: 1` only. A mismatch is a hard reject, not a
  negotiation. No multi-version support, no deprecation window.
- **No resume implementation.** Reconnect semantics are *defined* (the phase
  gate requires that) as: there is no resume in v1 — a dropped stream ends the
  run and the client starts a new one. The `seq` field is specified and emitted
  so resume can be added later without a version bump.
- **No compatibility shims.** The Phase 0 spike protocol is replaced outright,
  not dual-served.
- **No regression-preservation work.** Legacy chat tests stay as they are; they
  are not extended to cover the new protocol. Phase 7 deletes that path anyway.

`creditProxy`'s existing `/v1/generate` still stays, but for a concrete reason
rather than compatibility ceremony: chapter generation, prose enhancement,
next-line suggestions and the wizard all still call it, and they are not part of
the assistant. Phases 2 and 3 migrate them.

## Design decision: where schemas live and how three languages stay in sync

There are two *different* contracts in Phase 1 and conflating them is the main
risk.

1. **The assistant protocol** (P1-T1, P1-T2) — browser to gateway to agents.
   Runs, message parts, stream events, tool schemas.
2. **The model contract** (P1-T3) — agents to creditProxy. Provider-neutral chat
   with tool calling.

They share vocabulary but not lifecycle: the assistant protocol carries
approvals, references and editor context that creditProxy must never see, and
the model contract carries BYOK and reservation fields the browser must never
see. Keep them as separate schema families.

**Source of truth: Pydantic in `taleTribe-agents`, for the assistant protocol
only.** agents already runs FastAPI, so OpenAPI generation is free, and
`action_schemas.py` is an established in-repo precedent for strict models with
size limits. A small export script writes JSON Schema, and the frontend
generates TypeScript from it into a new workspace package. Go is *not*
generated: creditProxy owns a different contract, its types are hand-written in
`pkg/contracts/` as they are today, and the fixtures are what cross-check it.

Generating into three languages from one source would be worse here. The Go side
is not the same schema, so a shared generator would either force the two
contracts together or generate types nobody calls.

```
agents/assistant/protocol.py        (Pydantic, source of truth)
  |- scripts/export_schema.py  ->  assistant/schema/v1.json   (JSON Schema)
  |     \- frontend: packages/assistant-contracts/  (generated types + validator)
  \- assistant/fixtures/*.json      (canonical; vendored into the other repos)

creditProxy/pkg/contracts/chat.go   (hand-written)
  \- docs/openapi/llmproxy.yaml, gateway.yaml   (updated by hand)
```

## P1-T0: close the Phase 0 ownership gap

Repository: `taleTribe-agents`. Do this first; it is ten minutes and Phase 3
puts real story context behind this check.

`assistant_spike.py:58` calls `client.get_story(...)` directly and treats only
`NotFound` as denial. story-data serves a **published** story to any caller, so
that check passes for any published story regardless of owner.
`mcp_server/data.py:141` (`get_owned_story`) exists precisely to close this and
re-checks `ownerId == uid`.

- Replace the call with `data.get_owned_story(story_id, user_id)`, catching
  `StoryNotFoundError` and returning 403.
- Add a test where `get_story` returns `{"ownerId": "someone-else"}` and the
  endpoint returns 403. `tests/test_assistant_spike.py:75` only covers
  `NotFound`.

This also satisfies the standing invariant that read failures for unowned
stories are indistinguishable from not-found.

## P1-T1: message and stream schemas

Repository: `taleTribe-agents`, plus a generated frontend client.

Create an `assistant/` package at the repo root, alongside `mcp_server/`. The
assistant is a peer subsystem, not a story-agent tool.

```
assistant/
  __init__.py
  protocol.py     run request, message parts, terminal states
  events.py       the discriminated event union
  errors.py       closed error-code enum
  version.py      ASSISTANT_PROTOCOL_VERSION = 1
```

### Run request

Follow the shape in [the integration plan](assistant-ui-integration.md#run-request),
with the Phase 0 trust chain unchanged: the browser sends `storyId` and the
message; the Functions gateway verifies the Firebase token, checks story
ownership, derives `userId`, and forwards both to agents over the internal
token. `user_id` is a field agents receives from a trusted caller, never one the
browser asserts.

Required on the model: `model_config = ConfigDict(extra="forbid")`, explicit
`min_length`/`max_length` on every string, and a bounded `parts` list. Reuse the
`MAX_*` constants from `action_schemas.py` rather than inventing a second set.

`editorContext` is specified now but stays optional and unused until Phase 5.
Specifying it now is the point: Phase 5 should not need a protocol change.

### Stream events

One discriminated union on `type`. Every event carries:

- `v` — protocol version, so a stray event is self-describing.
- `runId` — correlation across gateway and agent logs.
- `seq` — monotonic per run, starting at 0. Emitted but not yet acted on.

Event set, minimum:

| Event | Notes |
| --- | --- |
| `run.started` | carries `runId`, and provider/model once known |
| `text.delta` | incremental; the Phase 0 adapter yields cumulative text, so the frontend accumulates |
| `text.done` | final text part, so reload does not depend on replaying deltas |
| `tool.started` / `tool.args.delta` / `tool.completed` / `tool.failed` | |
| `approval.requested` / `approval.resolved` | reserved; no tool requires approval until Phase 5 |
| `reference.emitted` | story or web source |
| `usage` | provider, model, prompt/completion tokens, credits, and one of `platform` / `byok` / `local` / `mock` |
| `run.completed` / `run.failed` / `run.cancelled` | exactly one terminal event per run |

Two properties worth enforcing in tests rather than prose: **exactly one
terminal event per run**, and **tool and message parts persist in the shape the
UI reloads** — no flattening structured parts back into strings.

This closes a real Phase 0 hole. `assistantSpikeStream.ts` throws
`"Assistant stream ended before completion"` when the socket closes without a
`done`, so a mid-stream agent failure is today indistinguishable from a dropped
connection. `run.failed` with a stable code fixes that.

### Errors

A closed enum in `errors.py`, every member safe to render to a user:
`unsupported_protocol_version`, `story_access_denied`, `quota_exceeded`,
`rate_limited`, `provider_unavailable`, `provider_error`, `run_cancelled`,
`stale_proposal`, `internal_error`.

The Phase 0 logging rules carry forward without exception: the code is the only
thing that crosses the boundary. No provider bodies, no exception messages, no
prompt text.

### Versioning

`ASSISTANT_PROTOCOL_VERSION = 1`. The run request carries it; a mismatch returns
HTTP 409 with `unsupported_protocol_version`. Compatibility policy, which is a
phase-gate item:

- **Reading:** ignore unknown object fields; reject an unknown `type` on the
  discriminated event union.
- **Writing:** strict. `extra="forbid"` everywhere.

That asymmetry is deliberate: a new optional field should not break an old
client, but an unrecognized event type means the stream is not what the reader
thinks it is.

### Frontend client

New workspace package `packages/assistant-contracts/`, matching the existing
`packages/platform-auth` and `packages/story-data-client` convention. It holds
generated types plus a hand-written runtime validator for the event union —
generated types alone validate nothing at runtime, and the event stream is
exactly where an unvalidated cast would hurt. `functions/` already depends on
`zod@^4`; use it here too rather than adding `ajv`.

## P1-T2: tool schemas

Repository: `taleTribe-agents`. Depends on P1-T1.

`assistant/tools.py`, following the `action_schemas.py` pattern: one strict
Pydantic model per tool, `MAX_*` module constants, and a single
`validate_tool_arguments()` entry point.

Declare all six read tools from the integration plan (`get_story_overview`,
`search_story`, `list_story_entities`, `get_story_entity`, `read_chapter`,
`read_current_editor`), plus `propose_editor_edit`, `apply_editor_edit` and
`research_web`. **Schemas only — no executors.** Phase 3 ports the read tools,
Phase 5 the editor tools, Phase 6 research. The reserved flags
`ASSISTANT_EDIT_PROPOSALS_ENABLED` and `ASSISTANT_RESEARCH_ENABLED` already
exist from P0-T4 and gate exposure of the corresponding schemas in the tool
list.

**The one structural invariant to get right.** The integration plan says to keep
verified user ID out of model-owned arguments. Enforce that by construction, not
by validation:

```python
class ToolContext:           # injected by the orchestrator
    user_id: str
    story_id: str

class ReadChapterArgs(BaseModel):   # model-owned; no identity fields exist
    model_config = ConfigDict(extra="forbid")
    chapter_id: str = Field(min_length=1, max_length=MAX_ID_CHARS)
    ...
```

If the argument models have no `user_id` or `story_id` field, a model cannot
assert one and `extra="forbid"` rejects the attempt. This is stronger than
checking the value after the fact, and it is the same reasoning that makes
`get_owned_story` the single ownership gate in P1-T0.

Add a test asserting that no tool argument model declares an identity field —
that is the invariant most likely to erode as tools are added in Phases 3 to 6.

Size and count limits go in the schema **and** are re-validated at the execution
boundary in Phase 3. Phase 1 owns the first half and the constants.

## P1-T3: provider-neutral model contract

Repository: `creditProxy`. Independent of T1/T2; can run in parallel.

Add `pkg/contracts/chat.go` alongside the existing `contracts.go`:

- `ChatRequest` — role-based `[]ChatMessage` with typed parts, `[]ToolSchema`,
  tool-choice policy, `MaxOutputTokens`, `Temperature`, `IdempotencyKey`, and
  the existing reservation/BYOK fields carried over from `GenerateRequest`.
- Normalized streaming events — text delta, tool-call delta, final usage,
  provider, model, finish reason, error.

`MaxOutputTokens` must keep its existing relationship to the gateway's
`MAX_OUTPUT_TOKENS` ceiling and to reservation sizing: reservations hold
`promptTokens + maxOutputTokens` converted to credits, and commit reconciles
down to real reported usage. A streaming tool-calling request does not change
that arithmetic, but it does mean the ceiling must be known *before* the stream
opens. Specify it as required, not optional, in the chat contract — this is the
one place the new contract should be stricter than `/v1/generate`.

Update `docs/openapi/llmproxy.yaml` and `docs/openapi/gateway.yaml` by hand.

**No implementation in Phase 1.** The deterministic mock provider is P2-T1. The
Phase 1 deliverable is types, OpenAPI, and a passing fixture round-trip.

## P1-T4: contract fixtures

Repositories: all three. Depends on T1, T2, T3.

Canonical assistant-protocol fixtures live in
`taleTribe-agents/assistant/fixtures/` — the protocol owner. The frontend
vendors a copy with a checked-in SHA-256 manifest and a CI step that fails on
drift. `creditProxy` instead checks its own model-contract fixtures because it
does not parse assistant events. Separate git repos mean there is no shared
package to import; a hash check is the cheapest honest substitute for one.

Fixture set, from the integration plan:

| Fixture | Exercises |
| --- | --- |
| `text-only.json` | the minimum viable run |
| `single-tool-round.json` | one tool call and result |
| `multi-tool.json` | ordering and interleaving with text |
| `approval-pause-resume.json` | reserved path, schema-validated now |
| `research-citations.json` | `reference.emitted` |
| `cancellation.json` | `run.cancelled` as a terminal state |
| `provider-error.json` | `run.failed` with a safe code |
| `stale-edit.json` | `stale_proposal` |

Each fixture is a complete event sequence, not a single event, so the
one-terminal-event and monotonic-`seq` invariants are testable.

Round-trip test per consumer — parse, re-serialize, assert deep equality:

- Python: `pytest` in `tests/test_assistant_contracts.py`.
- TypeScript: `vitest` in `packages/assistant-contracts/`.
- Go: `go test` in `pkg/contracts/`. Go round-trips only the model-contract
  fixtures; the assistant-protocol fixtures are not its contract.

## Retarget the spike instead of deleting it

The Phase 0 spike is disposable by design, and `assistantSpikeStream.ts` says
so. But the cheapest possible end-to-end proof of the v1 protocol is to point
the existing transport at it: keep `assistant_spike.py`'s mock generator and
`relayAssistantStream` exactly as they are, and emit real v1 events instead of
the ad-hoc `{"type":"text-delta"}` frames.

That converts the spike from a throwaway into the protocol's first integration
test — no model call, no credits, no persistence — and it exercises the
generated TypeScript validator against real bytes rather than a JSON file.
Replace `readSpikeStream` with the `packages/assistant-contracts` validator;
`assistant_stream_spike.cy.ts` should keep passing with only its assertions
updated.

Delete the hand-rolled `readSpikeStream` frame parser and its 16 KB byte cap;
the cap moves into the validator as a schema-level bound.

## Ordering

```
P1-T0 --+
P1-T1 --+--> P1-T2 --+
P1-T3 --+            +--> P1-T4 --> retarget spike
```

T0 first (small, and it is a live gap). T1 and T3 are independent and can run in
parallel across repos. T2 needs T1's part types. T4 needs all three.

Rough effort: T0 ~0.5h, T1 ~1d, T2 ~1d, T3 ~0.5d, T4 ~1d, spike retarget ~0.5d.

## Phase gate

From the integration plan, unchanged:

- Contract fixtures round-trip in TypeScript, Python and Go.
- Unknown fields and versions follow an explicit compatibility policy.
- No secret or authorization decision can be supplied by a model tool call.

Added for this plan:

- No tool argument model declares an identity field, asserted by test.
- Exactly one terminal event per run, asserted across every fixture.
- The retargeted spike streams v1 events end to end and Cypress passes.
- All new capabilities remain off by default; Phase 1 adds no executor.

## Explicitly not in Phase 1

Orchestration loop, tool executors, durable threads, the assistant UI shell,
editor bridge, research fetcher, creditProxy chat implementation, and any
migration of the legacy `chatWithContext` path. Each has a later phase.
