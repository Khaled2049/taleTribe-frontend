# Assistant Phase 0: baseline and transport decision

Date: 2026-09-11. Status: Phase 0 complete for local development. Scope: P0-T1 through P0-T4 of
[the integration plan](assistant-ui-integration.md#phase-0--baseline-decisions-and-safety-fixes).

## ADR: custom runtime, POST SSE, dedicated authenticated gateway

Use `@assistant-ui/react` **0.15.18**, pinned in package.json/yarn.lock, with
`useLocalRuntime` and an async-generator `ChatModelAdapter`. The adapter yields
cumulative text and passes cancellation to fetch. This builds with the existing
React 19/Vite 6 setup without `@assistant-ui/vite`; this spike does not use toolkit
compiler directives. This decision follows the library's
[custom-runtime options](https://www.assistant-ui.com/docs/runtimes/custom/overview)
and [LocalRuntime interface](https://www.assistant-ui.com/docs/runtimes/custom/local-runtime).
No ADK migration is needed.

Use authenticated POST requests with SSE response bodies, read using fetch
(so the Firebase ID token stays in a header). The browser sends storyId only in
this mock proof. The gateway verifies the Firebase token and story access using
the existing middleware, derives userId, and forwards trusted context to agents.
Agents recheck story access and apply the existing per-user request limiter.

The local path selected by the experiment is:

```text
browser -> Vite /assistant-spike proxy -> dedicated HTTP gateway :5002
        -> taleTribe-agents :8000 -> story-data ownership check
```

The alternative Firebase `onRequest` path streams incrementally in the emulator,
but browser cancellation does not reliably disconnect the upstream request:
agent logs showed `outcome=completed` after Stop and panel close. A unit test of
the relay and UI-only cancellation assertions both passed; neither alone proved
the emulator forwarded the disconnect. The dedicated gateway removes that
extra proxy boundary. Keep checking the agent's terminal outcome, not just the UI.

The adapter explicitly aborts its fetch on close, unmount and authentication loss
in addition to forwarding the runtime's abort signal. A mounted-state guard
prevents delayed token resolution from starting a request after panel disposal.
The gateway keeps its deadline alive through the whole body and aborts on socket
close. Its relay honors backpressure, filters upstream errors, and never retries
a partially opened stream.

The new `assistantGatewayDev.ts` executable is an emulator-only harness, not a
production deployment. A dedicated first-party gateway is the selected production
topology; its deployment/IAM/reverse-proxy configuration remains future work.
The production path must retain Firebase end-user verification, story ownership,
OIDC service identity, and real deployment cancellation tests before rollout.
Emulator evidence does not establish Cloud Run/load-balancer behavior.

This is a fixed three-delta transport proof: no LLM request, embeddings, credits,
tool execution, manuscript edits, or persistence. Real inference continues through
creditProxy. Phase 1 replaces the disposable spike events with versioned schemas,
terminal states, safe errors, event IDs, and explicit reconnect/resume semantics.
Do not ship the spike protocol as the assistant API.

## Baseline coverage and logging

The retained legacy path is `Chatbot -> chatStore -> sendChatMessage ->
chatWithContext -> creditProxy`, with Firestore legacy chat history and story-data
story ownership/context. No chat migration is performed in Phase 0.

| Behavior | Coverage |
| --- | --- |
| Start session, load history, receive realtime messages | `tests/chatStore.test.ts` and `cypress/e2e/ai_chat.cy.ts` |
| Send and persist a response | existing Cypress mock-provider test |
| Reopen history and clear thread | added Cypress flow and store regression |
| Quota refusal | existing real gateway 429 test and store regression |
| Provider failure | injected HTTP 500 Cypress test, store regression, agent error tests |
| Incremental streaming, Stop, close/unmount | opt-in `assistant_stream_spike.cy.ts`, socket relay test, agent terminal logs |
| Split/malformed/truncated streams | `tests/assistantSpikeStream.test.ts` |
| Default-off gates, owner authorization, internal auth dependency | Functions flag tests and agents spike tests |

The injected provider failure exercises the frontend failure behavior; it does
not claim to test a live hosted provider. All standard tests use mocks and local
emulators. BYOK with a real provider remains the existing explicitly skipped test.

Sanitized legacy request/response examples are in
[`fixtures/assistant-legacy-chat.json`](fixtures/assistant-legacy-chat.json).
Keep ownership, quota, safe-error, and failure regressions through the migration.
Replace store/Firestore-specific tests when Phase 7 removes that implementation.
Replace spike-specific tests with versioned protocol and run tests in Phases 1–4.

`chatWithContext` logs only context/prompt character counts, bounded history count,
provider class, correlation ID, and elapsed time. Full prompts and story IDs are
removed from that log. Retry and generation-failure logs record exception types
instead of exception messages/tracebacks, which can contain provider bodies or
keys. Regression tests cover story prose, title, history, questions, and fake BYOK
keys on success, failure, and retry paths. Other application logging is outside
this targeted audit.

## Rollout controls

| Variable | Owner | Default / effect |
| --- | --- | --- |
| `VITE_ASSISTANT_UI_ENABLED` | frontend | false; preview also requires Vite development mode |
| `VITE_ASSISTANT_LEGACY_FALLBACK_ENABLED` | frontend | true; controls legacy floating-panel presentation |
| `ASSISTANT_API_ENABLED` | Functions / agents | false; required for the spike and future API |
| `ASSISTANT_EDIT_PROPOSALS_ENABLED` | Functions / agents | false; reserved, no edit tools implemented |
| `ASSISTANT_RESEARCH_ENABLED` | Functions / agents | false; reserved, no research tools implemented |
| `ASSISTANT_LEGACY_FALLBACK_ENABLED` | Functions / agents | true; disabling rejects legacy send/clear and agent chat execution |
| `ASSISTANT_STREAM_SPIKE_ENABLED` | local stack / servers | false; explicit emulator/development-only transport proof |

Server switches are independent of presentation flags. Existing history reads
are not revoked by the legacy execution switch. New write and research tools
must check their server flags when implemented; flag declarations alone do not
implement a capability. Keep new capabilities off outside explicit development.

## Reproduce locally

Use Node 22 (Functions' supported runtime). From the workspace root, stop the
existing dev stack, then:

```sh
ASSISTANT_API_ENABLED=true ASSISTANT_STREAM_SPIKE_ENABLED=true \
VITE_ASSISTANT_UI_ENABLED=true USE_MOCK=true LLM_PROVIDER=mock \
SKIP_SEED=1 SKIP_RECS=1 ./dev-new.sh
```

Port 5002 is additionally required in spike mode. `dev-new.sh` starts and stops
the dedicated gateway along with the other services. `SKIP_SEED=1` preserves
existing local content; omit it for first-time setup. Recommendations are unrelated
to this proof and can be skipped to avoid a mock embedding/catalog mismatch.

From the frontend repository:

```sh
yarn cy:run --spec cypress/e2e/assistant_stream_spike.cy.ts --env assistantSpike=true
```

The Cypress test seeds its own local user/story. For manual testing, sign in,
open any owned story and the assistant, and send a preview message. Verify three
incremental chunks, Stop, and panel close. Agent logs should show a completed
normal run and cancelled stopped/closed runs. No provider keys are needed.

To reproduce the rejected Firebase-emulator route, additionally set
`VITE_ASSISTANT_SPIKE_FIREBASE=true` when starting Vite. The comparison endpoint
remains disabled outside the emulator.

Restart normally without these flags to restore the legacy UI and default-off
new endpoints. Run `yarn cy:run --spec cypress/e2e/ai_chat.cy.ts` against a mock
creditProxy for the legacy integration baseline.

## Verification record

- Frontend production build and unit suite pass (182 tests).
- Functions build and tests pass (15 tests), including a real-socket forwarding/disconnect test.
- Agents pytest suite passes (461 passed, one existing skip); focused Ruff/Black checks pass.
- `go test ./...` passes in story-data; no API/schema changes were needed.
- Full frontend lint has existing failures across unrelated files. New and
  changed prototype files are checked separately; this work does not repair the
  repository-wide lint baseline.
- Integrated dedicated-gateway Cypress: 3/3 pass (completion, panel close, Stop).
  Agent terminal logs confirm normal completion in 2.25 seconds, panel-close
  cancellation in 56 ms, and Stop cancellation in 69 ms after stream start.
  These are local observations, not production latency guarantees.
- Avoid using the displayed message count or exact transient text as a signal
  to cancel: waiting for those in the harness can allow the stream to finish.
  Trigger cancellation on the first available text and inspect agent terminal logs.
- Legacy integrated Cypress passes all four tests: send/persist, quota refusal,
  reload/clear, and provider failure. The existing real-key BYOK case stays skipped.
- Both the Firebase comparison endpoint and agent spike return HTTP 404 with
  default flags. The normal UI continues using the legacy chat.
