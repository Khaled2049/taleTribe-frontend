# Assistant Phase 2 implementation plan: creditProxy agent transport

Date: 2026-09-12. Status: in progress — P2-T1 through P2-T4 implemented, plus
Gemini from P2-T5. OpenAI/Anthropic and P2-T6 outstanding. Scope: P2-T0 through P2-T6 of
[the integration plan](assistant-ui-integration.md#phase-2--creditproxy-agent-capable-transport-and-hard-budgets).
Predecessor: [Phase 1](assistant-ui-phase-1-plan.md).

Phase 2 is almost entirely `creditProxy`. Phase 1 defined `ChatRequest` /
`ChatEvent` in `pkg/contracts/chat.go` and described `/v1/chat` in both OpenAPI
documents; nothing serves them. This phase makes them real and keeps the
billing boundary honest once a response arrives in pieces instead of all at
once.

The single fact that shapes the whole phase: **nothing in creditProxy streams
today.** There is no `http.Flusher`, no `text/event-stream`, and no SSE helper
in `pkg/httpx`. `Provider` (`cmd/llmproxy/provider.go:66`) has one method that
takes a flat prompt string and returns a finished `Output` string.

## Scope adjustment: development stage

The platform has no production users, no deployed assistant, and no chat data
worth preserving. This plan narrows the integration plan's Phase 2 accordingly:

- **No migration of `/v1/generate`.** It stays exactly as it is. Chapter
  generation, prose enhancement, next-line and the wizard keep calling it, and
  `/v1/chat` is added beside it. Phase 3 decides whether those callers move.
- **No compatibility surface.** `ChatContractVersion = 1` only; a mismatch is a
  400.
- **Thin tests.** Streaming billing state transitions and budget exhaustion get
  tests because they are arithmetic that is expensive to get wrong. Everything
  else is covered by the existing fixture round-trip in
  `pkg/contracts/chat_test.go` and one BDD smoke scenario. No provider-adversarial
  test matrix.
- **T6 (embeddings) is optional and last.** Embeddings run through
  `taleTribe-agents` directly today and are already metered by `MAX_INDEX_USAGE`
  per user per day. That is weak but not unbounded, and nothing in Phases 3-5
  depends on moving it.

## P2-T0: commit the Phase 1 leftovers

`creditProxy` has `docs/openapi/gateway.yaml`, `docs/openapi/llmproxy.yaml` and
`CLAUDE.md` uncommitted (+361 lines, the `/v1/chat` contract). The frontend has
`docs/assistant-ui-{integration,phase-0,phase-1-plan}.md` and `docs/fixtures/`
untracked. Commit both before starting; Phase 2 edits the same OpenAPI files.

## Design decisions

### 1. SSE on both hops, JSON-per-frame

Browser-facing transport is not decided here (that is Phase 4's problem, and
assistant-ui has its own preferences). Internally: gateway `/v1/chat` → llmproxy
`/v1/chat`, both `text/event-stream`, each frame a `data: <ChatEvent>` line
followed by a blank line. That is already what the Phase 1 OpenAPI says, so
this is implementing the documented shape rather than choosing a new one.

Two things in `pkg/httpx` block this and need adding:

- A streaming POST helper — `PostSSE(ctx, client, url, body, headers, func(contracts.ChatEvent) error) error`.
  `PostJSON` decodes a whole body and cannot be reused.
- A separate long-lived client. `NewHTTPClient(30 * time.Second)` sets
  `Timeout`, which covers the entire response body, so a 90-second stream dies
  at 30 — and passing 0 does not help, since the helper substitutes 15s for any
  non-positive value. Add `NewStreamingHTTPClient()` with no overall `Timeout`
  and a `ResponseHeaderTimeout` on the transport instead.

### 2. A second interface, not a wider one

Do not widen `Provider`. Add:

```go
type ChatProvider interface {
	Provider
	Chat(ctx context.Context, opts ChatOpts, emit func(contracts.ChatEvent) error) error
}
```

`handleChat` type-asserts and returns 501 with code `provider_unsupported` when
the configured provider does not implement it. Mock (T1) and Ollama (T4) land
without touching Gemini/OpenAI/Anthropic, and `/v1/generate` keeps working
throughout. `emit` returning an error means the client is gone — the provider
stops and the context is cancelled.

### 3. Billing across a stream

This is the part worth getting right; the rest is plumbing. Today
`cmd/gateway/main.go:160-250` reserves, calls llmproxy, and then either commits
the real usage or releases on failure — a clean two-outcome decision, because
the result is atomic. A stream has more outcomes, and the ordering rule is:

**Reserve before writing a single byte.** A 402 or a budget rejection must still
be an HTTP status the caller can branch on, not an error frame arriving after a
200. Once the first byte is written, the status is committed and every failure
is an `error` event with `finish_reason: "error"`.

**Track whether billable work started.** Set a `billableStarted` flag on the
first `text_delta` or `tool_call_delta` observed from llmproxy. Then:

| Outcome | Action |
| --- | --- |
| `usage` event received | commit the reported credits |
| provider error, `!billableStarted` | release |
| provider error, `billableStarted` | commit the full reservation |
| client disconnects mid-stream | commit the full reservation |
| stream ends with no `usage` event | commit the full reservation |

The last three are the conservative unknown-usage policy the integration plan
asks for: when the platform cannot know what it was charged, it assumes the
ceiling. Under-billing a user is a real cost and over-billing is a refundable
annoyance, and at this stage a wrong guess costs a development account nothing.

Ledger events keep the existing `IdempotencyKey + ":reserve"/":commit"/":release"`
suffix scheme, plus `":commit_unknown"` so the conservative path is visible in
the ledger rather than indistinguishable from a reconciled commit.

**Cancellation** rides on `r.Context()`. The gateway's request context cancels
on client disconnect, propagates into the `PostSSE` call, cancels the llmproxy
request, and cancels the provider request. No separate cancel endpoint.

### 4. Budgets reuse the Redis pattern already there

`cmd/usage/main.go:24` has `platformDailyScript` — an atomic increment-under-limit
Lua script, UTC-date-keyed, 90000s TTL, already reused for per-user purchase
caps. The token/credit budget is the same script against a different key, with
`INCRBY` instead of `INCR`:

```
platform:credits:<utc-date>   INCRBY estimated_credits, reject if > PLATFORM_DAILY_CREDIT_LIMIT
```

Charged at reserve time with the estimate, reconciled at commit by `INCRBY` of
the (usually negative) delta. A request cap alone does not bound spend once one
assistant run makes ten tool-calling round trips, which is exactly what Phase 3
starts doing.

New env, all in `.env.example` and `docker-compose.yml`:

- `PLATFORM_DAILY_CREDIT_LIMIT` (default 150000 — see the note below)
- `PLATFORM_INFERENCE_ENABLED` (default `true`) — the kill switch, checked in
  the gateway before reserve. Refuses platform-funded inference only; BYOK,
  `force_mock` and a validated local Ollama still pass.
- `MAX_CHAT_REQUESTS_PER_MINUTE_PER_USER` (default 60)

**Size the credit budget above the request cap, not below it.** The first
default here was 20000, and testing showed it would bind long before the
existing 1400-request cap — quietly tightening `/v1/generate` as a side effect
of adding a chat budget. 1400 requests at an 8192-token ceiling is ~140k
credits, so the default is 150000: a real backstop that is not the binding
constraint. The budget applies to every non-BYOK reservation, `/v1/generate`
included, because it lives in the usage service next to the request cap.

That last one matters: `MAX_REQUESTS_PER_MINUTE_PER_USER` is 10, and one
assistant run is several `/v1/chat` calls. The existing limiter would trip on
the second question a writer asks. `/v1/chat` gets its own `userRateLimiter`
instance rather than sharing the `/v1/generate` bucket.

### 5. A closed error-code set

`ChatError.Code` values, fixed now so agents can map them to the assistant
protocol's `errors.py` enum in Phase 3 without a second guess:
`insufficient_credits`, `platform_budget_exhausted`, `platform_inference_disabled`,
`rate_limited`, `provider_unavailable`, `provider_error`, `provider_unsupported`,
`cancelled`. Message stays a stable neutral string — never a provider body, which
can contain the prompt, which can contain the manuscript.

## Tasks

### P2-T1: mock chat provider

Files: `cmd/llmproxy/chat.go` (handler), `cmd/llmproxy/mock_chat.go`,
`cmd/llmproxy/provider.go` (add `ChatProvider`, `ChatOpts`).

`mock.go` today is 20 lines returning `"Mock response to: %s"`. The chat mock is
scripted: it reads a directive from the last user message (e.g.
`__script: multi-tool`) and replays one of the Phase 1 fixtures in
`pkg/contracts/testdata/chat/`, with a configurable inter-frame delay. Default
with no directive is `text-only`.

Scripting it off the existing fixtures is the point — the fixtures are already
the pinned contract, so the mock cannot drift from it, and every later phase
gets a free deterministic backend.

Also needs: a scripted failure (`__script: provider-error`), a hang for testing
client disconnect, and honouring `ctx.Done()` between frames.

### P2-T2: gateway `/v1/chat` with streamed billing

Files: `cmd/gateway/chat.go` (new), `pkg/httpx/httpx.go` (SSE helper + streaming
client).

Validation mirrors `handleGenerate`: version check, `ResolveBillingUser`,
`MaxOutputTokens` required and `<= MAX_OUTPUT_TOKENS`, message size bounded by
`MAX_PROMPT_CHARS` summed across parts, chat rate limiter, idempotency key.
Then reserve, open the llmproxy stream, relay frames, and apply the table in
decision 3.

Tests: the state table, as table-driven unit tests against a fake llmproxy
`httptest` server. That is the one place worth real coverage.

### P2-T3: global budget and kill switch

Files: `cmd/usage/main.go` (credit-budget script + endpoint), `cmd/gateway/chat.go`,
`.env.example`, `docker-compose.yml`, `terraform/`.

Per decision 4. The budget check goes inside the usage service's reservation
handler, next to the existing platform daily request cap, so it is atomic with
the same round trip rather than a second check the gateway could race.

One test: concurrent reservations against a low limit stop at the limit.

### P2-T4: Ollama chat and tools

File: `cmd/llmproxy/ollama.go`.

Move from `/api/generate` with `stream: false` to `/api/chat` with
`stream: true`, decoding the newline-delimited JSON stream into `ChatEvent`s.
Ollama already reports `prompt_eval_count` / `eval_count` in the final frame,
so usage normalization carries over.

Tool calls: models that support them return a `tool_calls` array on the message.
Models that do not simply never emit one — when `ToolChoice.Mode` is `required`
and the model produced no call, fail with `provider_unsupported` rather than
silently returning prose.

Local-unmetered mode (`OLLAMA_UNMETERED=true`) skips reservation entirely and
emits a `local_generate` ledger event with token counts. Gate it on the provider
actually being Ollama with a loopback or explicitly-configured base URL, so the
flag cannot be flipped into "free hosted inference".

### P2-T5: hosted providers

Files: `cmd/llmproxy/{gemini,openai,anthropic}.go`.

Each implements `Chat` against its own streaming API: Gemini
`streamGenerateContent`, OpenAI `/chat/completions` with `stream: true`,
Anthropic `/v1/messages` with `stream: true`. Normalize tool calls into
`ChatToolCallDelta` (Anthropic's `input_json_delta`, OpenAI's indexed
`tool_calls` deltas, Gemini's whole-object `functionCall`), finish reasons into
`FinishReason`, and usage into `GenerateUsage`.

Gemini first — it is the platform default. The other two can land later without
blocking Phase 3, since the mock covers development.

BYOK reuses `newProviderFromBYOK` unchanged; the gateway already skips
reservation when BYOK fields are set, and that logic carries over to
`handleChat` as-is.

### P2-T6: embeddings under a budget (optional, last)

Only if Phase 2 finishes early. A `/v1/embed` endpoint with hosted/Ollama/mock
adapters, the 768-dimension contract enforced and failing loudly on mismatch,
and a separate atomic daily budget. Then `taleTribe-agents`'
`embedding_provider.py` routes through it. Deferring this is safe:
`MAX_INDEX_USAGE` already caps per-user daily embedding, and nothing in the
assistant path depends on it.

## Implementation record (P2-T1 to P2-T3)

Delivered in `creditProxy`:

- `pkg/contracts/fixtures.go` embeds the chat fixtures; `cmd/llmproxy/mock_chat.go`
  replays them as a scripted `ChatProvider`, so the mock cannot drift from the
  contract.
- `cmd/llmproxy/chat.go` serves `/v1/chat` in both SSE and buffered form, and
  holds the response open until the first event.
- `pkg/httpx` gained `PostSSE` and `NewStreamingHTTPClient`.
- `cmd/gateway/chat.go` implements the billing state machine, the kill switch,
  the chat rate bucket, and settlement on a detached context.
- `cmd/usage/main.go` adds `platformCreditsScript`; `commitScript` and
  `releaseScript` now return the reserved amount so the budget reconciles.

Verified end to end against the running stack (`docker compose up`,
`LLM_PROVIDER=mock`): a streamed tool-call round trip, real-usage commit
(balance 10000 → 9994 for 6 credits), release on a pre-output failure (balance
untouched), full-hold commit on a mid-stream error, buffered mode, budget
exhaustion, the kill switch refusing platform work while BYOK passes, and
`/v1/generate` unchanged.

Deviation from the plan as written: the gateway also serves `stream: false`, by
forwarding it to llmproxy and returning the aggregated `ChatResponse`. The plan
implied streaming only, but the Phase 1 OpenAPI documents both, and reusing
llmproxy's aggregation was cheaper than duplicating it in the gateway.

## Implementation record (P2-T4, and Gemini from P2-T5)

Scope call: **Ollama and Gemini only.** OpenAI and Anthropic keep
`/v1/generate` and return 501 for chat until someone needs them.

- `cmd/llmproxy/ollama_chat.go` — `/api/chat` with `stream: true`, NDJSON frames
  normalized into `ChatEvent`s. Ollama sends a tool call as one complete object
  and no call id, so the id is minted.
- `cmd/llmproxy/gemini_chat.go` — `streamGenerateContent?alt=sse`, with
  `functionDeclarations`, `toolConfig`, `systemInstruction`, and `usageMetadata`.
  Gemini keys a `functionResponse` by function *name* and has no call id either,
  so the name is recovered from the assistant turn that requested the call.
- A model that ignores `tool_choice: required` fails with `unsupported_model`
  rather than returning prose the orchestrator would parse as a tool result.
- Local-unmetered mode: `LOCAL_UNMETERED` makes the gateway skip metering and
  emit a `local_generate` ledger event. llmproxy **refuses to start** unless the
  provider is Ollama on a loopback, private, dotless or `host.docker.internal`
  address, so the flag cannot be flipped into free hosted inference. One
  variable read by both services, and deliberately absent from Terraform.

Verified live against Ollama (`gemma4:latest` on the host): streamed text
deltas billed 1 credit, a real tool call returning
`finish_reason: "tool_calls"` with a minted call id, unmetered mode leaving the
balance at 10000 with a `local_generate` ledger row, and the startup guard
refusing `LLM_PROVIDER=gemini` with `LOCAL_UNMETERED=true`.

**Gemini is unit-tested, not live-verified** — there is no `GEMINI_API_KEY` in
this environment. Its adapter is covered by a canned SSE stream and a message-
conversion test; the first real key should exercise a tool round before it is
trusted.

## Ordering

```
P2-T0 -> P2-T1 -> P2-T2 -> P2-T3 -> P2-T4 -> P2-T5 -> (P2-T6)
```

T1 and T2 are the critical path and unblock Phase 3 by themselves — an agent
loop against a scripted mock is a complete development environment. T3 should
not slip far behind T2, because the budget is the thing that makes a looping
agent safe to leave running. T4 and T5 are mechanical.

Rough effort: T0 ~15m, T1 ~0.5d, T2 ~1.5d, T3 ~0.5d, T4 ~1d, T5 ~1.5d, T6 ~1d.

Phase 4 (the assistant-ui shell against Phase 1 fixtures) is unblocked now and
runs in parallel with all of this.

## Phase gate

- Mock and Ollama each complete a streamed tool-call round trip through
  gateway → llmproxy.
- Every outcome in the billing state table has a test.
- Daily credit exhaustion and the kill switch both refuse new platform-funded
  work, atomically, while BYOK and mock still pass.
- BYOK keys appear in no log line and no ledger payload.
- `/v1/generate` and its smoke suite still pass unchanged.

## Explicitly not in Phase 2

The agent orchestration loop, tool executors, the assistant UI, editor context,
research, durable threads, and any change to `/v1/generate`'s callers. The
deliverable is a transport that streams tool calls and bills them correctly.
