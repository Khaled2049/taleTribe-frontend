# Assistant Phase 3 implementation plan: read-only story agent and run loop

Date: 2026-09-12. Status: implemented on `feature/assistant-ui`. Scope: P3-T1 through P3-T5 of
[the integration plan](assistant-ui-integration.md#phase-3--read-only-story-agent-and-streaming-run-loop).
Predecessor: [Phase 2](assistant-ui-phase-2-plan.md) (P2-T1 to P2-T3 done;
T4/T5/T6 outstanding and not required here).

Phase 3 is `taleTribe-agents`. It replaces the one-shot `chatWithContext` prompt
with a bounded tool-calling orchestrator that answers grounded questions about a
story, streams its work as v1 assistant events, and mutates nothing.

**It does not need the rest of Phase 2.** The scripted mock in creditProxy is a
complete streaming tool-calling backend, so the loop can be built and tested
end to end with `LLM_PROVIDER=mock`. The only consequence of P2-T4/T5 being
open is that a *real* model cannot serve a run yet — `ChatProvider` is
implemented by the mock alone, and every other provider returns 501.

## What Phase 1 already left behind

Worth stating plainly, because it changes what this phase actually is. Phase 1
did not just define types:

- `assistant/tools.py` has all nine tool schemas, `ToolContext`,
  `available_tools(edits_enabled=…, research_enabled=…)` and
  `validate_tool_arguments()`. **Schemas only — no executors.**
- `assistant/events.py` has every event class, `RunEvents` (monotonic `seq`,
  one-terminal-event enforcement), `encode_sse`, and `validate_event_sequence`.
- `assistant_spike.py` already does the whole endpoint envelope: version check,
  internal-token auth, per-user rate limit, `get_owned_story` ownership check,
  `StreamingResponse` with the right SSE headers, and proven cancellation
  teardown.
- `mcp_server/data.py` already implements owner-checked reads against
  story-data: `get_story_overview`, `list_chapters`, `get_chapter`,
  `list_entities`, `get_entity`, all funnelling through `get_owned_story`.

So Phase 3 is narrower than it looks: **replace `mock_events()` with a real
loop, and give the existing schemas executors that mostly delegate to
`mcp_server/data.py`.** The genuinely new code is the orchestrator, the
creditProxy chat client, and one tool (`search_story`) that has no MCP
equivalent.

## Scope adjustment: development stage

- **No compatibility endpoint.** P3-T5 as written keeps `chatWithContext` alive
  or adapts it internally. Neither is worth doing: there are no production
  users, the assistant sits behind `ASSISTANT_API_ENABLED` (default false), and
  Phase 7 deletes the legacy path anyway. Leave `chatWithContext` exactly as it
  is and let the flag decide which surface the frontend calls.
- **Thin tests.** Ceilings, the ownership gate, and the identity invariant get
  tests. The tool executors get one fixture-backed happy path each, not a
  matrix.
- **No durable threads.** `threadId` is accepted and echoed; nothing is
  persisted. Phase 7 owns storage.

## Design decisions

### 1. A finish reason for "hit the ceiling" does not exist yet

The integration plan requires the loop to "stop with a clear partial-result
state when a ceiling is reached". The protocol cannot express that today:

```python
class RunCompleted(BaseEvent):
    finish_reason: Literal["stop", "length", "tool_calls"] = "stop"
```

`stop` claims the model finished answering. `length` means the output token
ceiling was hit. Neither is true when the orchestrator stopped the loop after N
model calls, and `run.failed` is wrong too — the user has a partial answer, and
`QUOTA_EXCEEDED`'s user-facing string talks about a daily allowance.

**Add `"max_steps"` to the literal and regenerate.** This is a real protocol
change, and Phase 1's single-version policy means it is not free: re-export
`assistant/schema/v1.json`, regenerate `packages/assistant-contracts`, and
re-hash the fixture manifest in both repos. That is exactly the machinery Phase
1 built, and it is cheaper than shipping a terminal state that lies. Do it
first, in its own commit, so the schema drift check stays green for everything
after it.

The alternative — leaving the literal alone and reporting `stop` — was rejected
because Phase 4 will want to show "I stopped early, ask me to continue" and
cannot infer it from an event that says the model was done.

### 2. The chat client belongs on `CreditProxyProvider`, not in `assistant/`

`CreditProxyProvider` already owns the GCP OIDC header, the forwarded
`X-Firebase-Token`, the BYOK `ContextVar`, the typed error classification
(`InsufficientCreditsError`, `RateLimitedError`, …) and the retry policy. A
second HTTP client in `assistant/` would duplicate all of it and drift.

Add one method:

```python
async def chat_stream(
    self, messages, tools, *, max_output_tokens, idempotency_key,
) -> AsyncIterator[dict]:
```

posting to `/v1/chat` with `stream: true` and yielding parsed `ChatEvent`
dicts. Reuse `_build_payload`'s BYOK/user-id resolution; note that the chat
contract requires `max_output_tokens` (unlike `/v1/generate`, which defaults
it), and that `httpx.AsyncClient(timeout=300.0)` is already shaped for a long
response.

Do **not** retry `chat_stream` on `BackendUnavailableError` the way
`generate_content_async` does. A retried stream after partial output would
double-bill and replay deltas the client already rendered; Phase 2 commits the
full hold on a broken stream precisely because it cannot know what happened.

### 3. Two event vocabularies, translated in exactly one place

creditProxy speaks `text_delta` / `tool_call_delta` / `usage` / `done` /
`error`. The assistant protocol speaks `text.delta` / `tool.started` /
`tool.args.delta` / `tool.completed` / `usage` / `run.completed`. They are
deliberately different contracts (Phase 1's central decision), so the loop
translates once, in `assistant/run.py`, and nothing downstream branches on a
creditProxy shape.

Mapping worth pinning down now:

| creditProxy | assistant | notes |
| --- | --- | --- |
| `text_delta` | `text.delta` | accumulate for the final `text.done` part |
| `tool_call_delta` (first, has name) | `tool.started` | |
| `tool_call_delta` (subsequent) | `tool.args.delta` | |
| `usage` | `usage` | **one per model call**, so a run emits several |
| `done` finish `tool_calls` | — | drives the next loop turn, not a terminal event |
| `error` | `run.failed` | map the code; never forward the message |

`chat.go`'s codes map onto `ErrorCode` as: `rate_limited` → `RATE_LIMITED`,
`insufficient_credits` / `platform_budget_exhausted` /
`platform_inference_disabled` → `QUOTA_EXCEEDED`, `provider_unsupported` /
`provider_error` → `PROVIDER_ERROR`, everything else →
`PROVIDER_UNAVAILABLE`. Anything unmapped is `INTERNAL_ERROR`.

A run emitting multiple `usage` events is new for the frontend — Phase 4 must
sum them rather than treating the first as the total.

### 4. Executors delegate to `mcp_server/data.py`; only `search_story` is new

Five of six read tools are a thin adapter over functions that already exist and
already re-check `ownerId == uid`:

| Tool | Backed by |
| --- | --- |
| `get_story_overview` | `data.get_story_overview` |
| `list_story_entities` | `data.list_entities` |
| `get_story_entity` | `data.get_entity` |
| `read_chapter` | `data.get_chapter`, sliced to the `offset`/`limit` window |
| `read_current_editor` | the run request's `editorContext` — not a data source |
| `search_story` | **new**: `embedding_provider` + `PostgresStoryContext.retrieve` |

`read_current_editor` returning the buffer the browser sent is the honest v1
behaviour: `editorContext` is optional and unused until Phase 5, so in Phase 3
the tool returns "no active editor" unless the frontend supplied one. Register
it anyway — a tool that appears in Phase 5 changes the model's behaviour
mid-project in ways that are hard to attribute.

`search_story` is the one place a story-scoped, owner-authorized boundary has to
be re-established by hand: `PostgresStoryContext.retrieve(story_id, embedding,
top_k)` filters by `story_id` in SQL, and the `story_id` comes from
`ToolContext`, never from model output. Every hit becomes a `SourcePart` via
`reference.emitted`, so an answer about prose can be traced to a chunk.

### 5. Ceilings are config, and the loop stops itself

New settings in `config.py`, all with defaults that make a runaway loop
impossible rather than merely unlikely:

| Setting | Default | Why |
| --- | --- | --- |
| `ASSISTANT_MAX_MODEL_CALLS` | 4 | one answer, plus up to three tool rounds |
| `ASSISTANT_MAX_TOOL_CALLS` | 10 | across the whole run, not per turn |
| `ASSISTANT_MAX_OUTPUT_TOKENS` | 2048 | per model call; must stay `<= MAX_OUTPUT_TOKENS` in creditProxy |
| `ASSISTANT_RUN_TIMEOUT_SECONDS` | 120 | wall clock for the whole run |
| `ASSISTANT_MAX_TOOL_RESULT_CHARS` | 8000 | per result, before it re-enters the prompt |

The result cap is the one that actually bounds cost: `read_chapter` already
allows a 20 000-character window, and three of those in a growing message list
is how a bounded loop becomes an expensive one.

Step idempotency keys are deterministic — `f"{run_id}:{step_index}"` — so a
duplicate step cannot double-charge, and the ledger shows the run's shape.

### 6. Cancellation bills

The spike proved that a client disconnect tears the generator down. Phase 3
adds a fact worth writing in the code: Phase 2's gateway **commits the full
hold** when a stream dies, so a cancelled run still costs the reserved credits
for its in-flight model call. The loop must therefore cancel the creditProxy
request promptly on disconnect, and must not start a new model call once the
run's context is cancelled.

## Tasks

### P3-T0: add `max_steps` and regenerate

Repositories: `taleTribe-agents`, then `taleTribe-frontend`.

Per decision 1. Edit the `RunCompleted` literal, re-run the schema exporter,
regenerate `packages/assistant-contracts`, refresh both fixture manifests, and
add a fixture (`max-steps.json`) so the new terminal state is covered by the
round-trip tests that already exist. Small, and everything else stacks on it.

### P3-T1: the run endpoint

Repository: `taleTribe-agents`, plus the frontend relay Function.

New `assistant/api.py` with `POST /assistant/run`, built by lifting
`assistant_spike.py`'s envelope wholesale — version check, internal token,
rate limiter, `get_owned_story`, `StreamingResponse` with
`Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`. Gate on
`ASSISTANT_API_ENABLED`.

Keep `assistant_spike.py` until the run endpoint is green, then delete it and
its Cypress spec in the same commit; two endpoints emitting v1 events is a
maintenance trap.

Frontend: point `relayAssistantStream` at `/assistant/run`. No other frontend
work — Phase 4 owns the UI.

### P3-T2: the orchestrator

Repository: `taleTribe-agents`. New `assistant/run.py`.

```
build system prompt + message list
loop while step < MAX_MODEL_CALLS and not cancelled:
    chat_stream(messages, tools=available_tools(edits_enabled=False, research_enabled=False))
    translate events -> RunEvents frames
    if finish_reason != "tool_calls": emit run.completed(finish_reason); return
    for each tool call: validate -> execute -> append role="tool" message
emit run.completed(finish_reason="max_steps")
```

`available_tools(edits_enabled=False, research_enabled=False)` is called
unconditionally in Phase 3 — the flags exist, but the edit and research
executors do not, so exposing their schemas would let the model call something
that cannot run.

Tool results re-enter the prompt as data, never as instructions. The system
prompt says so, and the executor output is JSON, not prose.

### P3-T3: tool executors

Repository: `taleTribe-agents`. New `assistant/executors.py`.

One `async def` per read tool, each taking `(args: BaseModel, ctx: ToolContext)`
and returning a JSON-serializable dict. Per decision 4. Re-validate the bounds
at the execution boundary — `validate_tool_arguments` ran on model output, and
the result sizes those arguments imply are capped here, which is the half Phase
1 deliberately deferred.

Story references: `search_story` and `read_chapter` emit `reference.emitted`
with a `SourcePart` carrying the chunk or chapter id and a bounded snippet.

### P3-T4: retrieval routing

Repository: `taleTribe-agents`.

Prompt-level, not code-level: the system prompt tells the model to use
`get_story_entity` / `list_story_entities` for named facts and `search_story`
for prose questions. Two things the prompt cannot do, which code must:

- **Index lag is visible.** `search_story` returns the chunk's indexed
  timestamp, and the executor marks results older than the chapter's
  `updatedAt` as stale rather than presenting them as current.
- **The slim roster is cheap context.** `PostgresStoryContext.format_slim_context`
  already renders a bounded roster; include it in the system prompt so simple
  questions do not need a tool round at all.

### P3-T5: (reduced) usage guard

Repository: `taleTribe-agents`.

Not the compatibility endpoint — see the scope adjustment. What is worth
keeping from the original T5 is the test: assert that a single assistant turn
makes at most `ASSISTANT_MAX_MODEL_CALLS` calls to creditProxy, so a future
prompt change cannot quietly turn one question into twelve billed requests.

## Ordering

```
P3-T0 -> P3-T1 -> P3-T2 -> P3-T3 -> P3-T4 -> P3-T5
                     \-> P3-T3 can start in parallel; it has no loop dependency
```

T3's executors are pure functions of `(args, ctx)` and can be written and tested
before the loop exists. Everything else is a chain.

Rough effort: T0 ~0.5d, T1 ~0.5d, T2 ~1.5d, T3 ~1.5d, T4 ~0.5d, T5 ~0.25d.

## Phase gate

- The mock provider answers a story question through observable tool calls,
  end to end, with `LLM_PROVIDER=mock`.
- Character, place, plot and chapter questions emit `reference.emitted`.
- No registered tool can mutate data or reach the public web.
- Every ceiling has a test, and hitting one ends the run with
  `finish_reason: "max_steps"` rather than a failure.
- An unowned story is refused before the model is called, indistinguishably
  from not-found.
- No tool argument model declares an identity field — the Phase 1 test still
  passes with the executors registered.

## Explicitly not in Phase 3

Editor writes, approvals, research, durable threads, the assistant UI, and any
change to `chatWithContext`. Phase 4 can start against the Phase 1 fixtures in
parallel with all of this.
