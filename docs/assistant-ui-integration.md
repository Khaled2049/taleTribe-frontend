# Assistant UI integration and editor-agent overhaul

Status: proposed implementation plan  
Phase 0 completed locally: [verification and transport ADR](assistant-ui-phase-0.md)  
Scope: `taleTribe-frontend`, `taleTribe-agents`, `story-data`, and `creditProxy`  
Out of scope: implementation in this document, production-data migration, image
generation, recommendations, and the external MCP consent experience

## Purpose

Replace the editor's text-only custom chat with an assistant-ui-based writing
assistant that can:

- Answer grounded questions about the active story, including characters,
  places, plots, chapters, and selected text.
- Understand the current editor buffer, including changes that have not yet
  reached the semantic index.
- Propose targeted rewrites or larger chapter revisions.
- Show a reviewable diff and require the writer to approve changes before they
  reach the editor.
- Perform bounded web research and answer with visible sources.
- Stream text, tool activity, errors, usage, and approval states into a polished
  assistant interface.
- Continue routing every model call through `creditProxy`, including local
  Ollama calls, so there is one provider boundary and one place for limits.

The project is still under development and has no production chat data to
preserve. Existing assistant threads and Firestore chat documents may be reset
or replaced rather than migrated.

## Non-goals

- The model will not silently edit a manuscript.
- assistant-ui will not become the source of truth for stories or chapters.
- The browser will not receive provider keys, database credentials, service
  tokens, or an unrestricted Ollama URL.
- This work will not enable arbitrary model-generated network requests or
  arbitrary server-side code execution.
- The first release will not attempt fully autonomous multi-chapter rewriting.
- The blockchain `contracts` repository is not the home for assistant API
  schemas; those are HTTP/runtime contracts, not smart contracts.

## Current state

The existing path is:

1. `SimpleEditor` renders `FloatingChatButton`.
2. `Chatbot` reads a Zustand `chatStore`.
3. The browser reads chat history directly from Firestore and calls the
   `sendChatMessage` Firebase Function.
4. The Function checks ownership and AI access, loads the last ten messages,
   and invokes `chatWithContext` in `taleTribe-agents`.
5. `chatWithContext` loads a slim story roster, retrieves four pgvector
   excerpts, builds one large string prompt, and asks `creditProxy` for one text
   completion.
6. The Function writes the user and assistant messages back to Firestore.

Useful foundations already exist:

- Firebase identity, story ownership checks, server-to-server OIDC, BYOK
  settings, and AI-access checks.
- PostgreSQL story context, pgvector retrieval, and the indexing outbox.
- `story-data` revisions and `If-Match` conflict handling.
- TipTap commands, undo history, and the editor's autosave pipeline.
- MCP read tools and a well-tested block-editing design with revision tokens,
  operation limits, idempotency, and audit metadata.
- `creditProxy` provider routing, per-user credits, reserve/commit/release,
  rate limiting, a global daily request cap, BYOK handling, Ollama, and an
  append-only usage ledger.

Important gaps:

- The current model interface accepts a prompt and returns a string. It does
  not support message parts, native tool calls, streaming, cancellation, or
  citations.
- One visible assistant turn may require several model calls. The current
  agent endpoint limit counts the outer request, not every internal model step.
- The global platform limit counts requests, but does not enforce a global
  daily token or credit ceiling.
- The current query embedder may call a provider outside `creditProxy`.
- Current MCP writes still target Firestore and are disabled when `story-data`
  is configured.
- The current chat prompt is logged at info level. Story text must not be placed
  in normal application logs.

## Architectural decisions

These are the recommended defaults. Phase 0 should record any deliberate
change before implementation begins.

### 1. assistant-ui is the UI/runtime layer

Use `@assistant-ui/react` for the thread, composer, message parts, tool-call
rendering, errors, retries, and approval UI. Do not put story retrieval,
authorization, billing, or mutation logic in assistant-ui components.

The existing Python service is a custom FastAPI application, not currently a
Google ADK application. Start with assistant-ui's custom runtime or Assistant
Transport. Do not migrate the backend to Google ADK solely to adopt the UI.
Revisit the dedicated ADK runtime only if `taleTribe-agents` is separately
converted into a real ADK agent.

Use the current toolkit APIs. Avoid deprecated assistant-ui APIs such as
`useAssistantTool` and `makeAssistantTool` in new code.

### 2. Keep the trusted request chain

The preferred request path remains:

```text
browser
  -> authenticated first-party Firebase/HTTP gateway
  -> OIDC-authenticated taleTribe-agents service
  -> creditProxy for every model or embedding request
  -> story-data for canonical story reads and writes
```

The streaming transport must be proven before committing to an endpoint shape.
If the existing Firebase Function path buffers server-sent events or does not
propagate cancellation reliably, add a dedicated authenticated streaming
gateway. Do not solve buffering by exposing an unauthenticated internal agent
endpoint.

### 3. Read automatically; propose writes; require approval

Story reads and semantic retrieval may run automatically after authorization.
Any mutation must first produce a proposal. The writer must approve the exact
proposal in the UI before it is applied.

For the active chapter, apply approved changes to the browser's TipTap instance,
not directly to the database. This preserves unsaved work and undo history and
lets the existing autosave path persist the result through `story-data`.

Backend mutations for characters, places, plots, or inactive chapters are a
later capability. They must use `story-data`, carry `If-Match`, and have the
same approval requirement.

### 4. Use deterministic tools for facts and RAG for prose

Questions about a named entity should use an entity tool rather than hoping a
vector search returns the record. Semantic retrieval remains appropriate for
questions about scenes, themes, continuity, or where something occurred.

The agent should distinguish two source types:

- `story_reference`: chapter, character, place, plot, or current editor buffer.
- `web_reference`: external research with title, URL, publisher, date, and
  retrieval metadata.

### 5. Ollama still goes through creditProxy

Local development must use this path:

```text
taleTribe-agents -> creditProxy -> llmproxy -> Ollama
```

The agent must not connect directly to Ollama. Local calls may be configured as
unmetered in the credit ledger, but they must still obey request, concurrency,
context, output-token, model-step, tool-step, and timeout limits.

The local bypass must be impossible to enable accidentally in production. A
startup validator should require all of the following before unmetered mode is
allowed:

- The runtime environment is explicitly development/test.
- The configured provider is `ollama` or `mock`.
- A separate `ALLOW_UNMETERED_LOCAL_AI=true` acknowledgement is present.

Production should fail startup if local-unmetered mode is selected.

## Target flow

```text
TipTap editor + EditorBridge
             |
             | story ID, chapter ID, selection, local document version
             v
assistant-ui runtime and thread
             |
             | authenticated command / streamed assistant events
             v
taleTribe-agents run orchestrator
             |
             +-- story tools --------> story-data
             +-- semantic search ----> pgvector
             +-- research tool ------> controlled search/fetch provider
             +-- model steps --------> creditProxy --------> hosted model
             |                              |
             |                              +---------------> Ollama locally
             v
tool results, source parts, text deltas, and edit proposal
             |
             v
assistant-ui diff + explicit approval
             |
             v
TipTap transaction -> undo history -> autosave -> story-data If-Match update
```

## Proposed contracts

Phase 1 owns the final schemas. The following shapes describe the required
semantics, not fixed field names.

### Run request

The server must derive `userId` from verified authentication. The model and
browser must not be allowed to assert another user.

```json
{
  "threadId": "optional-existing-thread",
  "clientMessageId": "idempotency-key",
  "message": {
    "parts": [{ "type": "text", "text": "Rewrite this more urgently" }]
  },
  "editorContext": {
    "storyId": "story-id",
    "chapterId": "chapter-id",
    "persistedRevision": 7,
    "documentVersion": 42,
    "selection": {
      "from": 840,
      "to": 1062,
      "text": "selected plain text"
    },
    "dirty": true
  }
}
```

Do not send the entire book on every request. Send the selected text and the
minimum active-buffer context needed for freshness. The server retrieves
persisted story context as needed.

### Stream events

The normalized stream needs, at minimum:

- Run started/completed/failed/cancelled.
- Text delta and final text part.
- Tool call started/arguments/completed/failed.
- Approval requested/resolved.
- Story or web reference emitted.
- Usage update with provider, model, prompt tokens, completion tokens, credits,
  and whether the request was platform, BYOK, local, or mock.
- A stable error code safe to show to the client.

Tool-call and message parts should be persisted in the same shape the UI can
reload; do not flatten them back into plain strings.

### Initial tool set

Read-only tools:

| Tool | Purpose |
| --- | --- |
| `get_story_overview` | Metadata and ordered chapter titles |
| `search_story` | Story-scoped semantic search with references |
| `list_story_entities` | List characters, places, or plots |
| `get_story_entity` | Read one complete character, place, or plot record |
| `read_chapter` | Read a bounded window from a persisted chapter |
| `read_current_editor` | Read the current selection or active browser buffer |

Action and research tools:

| Tool | Purpose | Approval |
| --- | --- | --- |
| `propose_editor_edit` | Return structured operations against the active TipTap document | Proposal is automatic; applying it requires approval |
| `apply_editor_edit` | Browser-side application of an approved proposal | Always |
| `research_web` | Perform bounded external research and return sources | No mutation approval; respect research budget |
| `update_story_entity` | Later: update a character, place, or plot through story-data | Always |

Tool schemas must be strict, versioned, size-limited, and validated again at
the execution boundary. Model output is untrusted even when it matches a tool
schema.

#### Telling the writer about them: `/help`

The panel answers `/help` (and `/?`) in the browser -- no request, no model
call, no credits -- from a catalog generated out of the same tool registry the
table above describes. See
[the plan](assistant-ui-help-command-plan.md).

The catalog is `assistant/help.py` in taleTribe-agents, exported into
`schema/v1.json` under `capabilities`, vendored here by
`scripts/sync_assistant_fixtures.py`, and compiled into `CAPABILITIES` by the
contracts package. `tests/test_assistant_help.py` asserts the catalog
partitions `TOOL_SCHEMAS`, so **a new tool without help copy fails CI** rather
than quietly going undocumented. Each entry carries a `gate` mirroring
`available_tools`, which is why `research_web` -- registered but with no
executor, and hardcoded off in `run.py` -- is never listed.

Matching is exact: `/helo` and `/help me tighten this` are ordinary prompts and
go to the model. An editor approval resume is never parsed as a command.

### Editor proposal

```json
{
  "proposalId": "proposal-id",
  "storyId": "story-id",
  "chapterId": "chapter-id",
  "baseRevision": 7,
  "baseDocumentVersion": 42,
  "summary": "Tighten the exchange and make Mina sound guarded.",
  "operations": [
    {
      "type": "replace",
      "from": 840,
      "to": 1062,
      "originalText": "original selected text",
      "replacementText": "proposed replacement"
    }
  ]
}
```

Initial editor operations should be limited to `replace` and `insert`. Deletion
is a replace with an empty value and must be labeled clearly in the diff.

Before applying, the frontend must verify:

- The story and chapter are still active.
- `baseDocumentVersion` is still current.
- The range still contains `originalText`.
- Operation ranges are valid, ordered, non-overlapping, and within configured
  limits.

If any check fails, mark the proposal stale and ask the agent to re-read the
editor. Never guess a new range.

## Configuration and spend controls

All limits below are server-authoritative. A `VITE_` setting may display a
limit, but it must never enforce billing or authorization.

### Existing controls to preserve

- `INITIAL_CREDITS`
- `TOKENS_PER_CREDIT`
- `PLATFORM_DAILY_REQUEST_LIMIT`
- `MAX_REQUESTS_PER_MINUTE_PER_USER`
- `MAX_PROMPT_CHARS`
- `MAX_OUTPUT_TOKENS`
- Atomic credit reservation before platform-funded inference.
- Commit against actual provider usage and release on provider failure.
- BYOK requests skip platform credit spending and never persist user keys.
- `MAX_INDEX_USAGE` for embedding/indexing work.

### Proposed assistant controls

Names are provisional but semantics should remain explicit:

| Setting | Suggested initial default | Meaning |
| --- | ---: | --- |
| `ASSISTANT_ENABLED` | `false` until rollout | Global kill switch |
| `ASSISTANT_MAX_CONCURRENT_RUNS_PER_USER` | `1` | Prevent parallel run amplification |
| `ASSISTANT_MAX_MODEL_CALLS_PER_RUN` | `4` | Includes tool-loop continuation calls |
| `ASSISTANT_MAX_TOOL_CALLS_PER_RUN` | `8` | Total tool executions in one visible turn |
| `ASSISTANT_MAX_RESEARCH_CALLS_PER_RUN` | `2` | External searches/fetch batches per turn |
| `ASSISTANT_MAX_TOTAL_OUTPUT_TOKENS_PER_RUN` | `4000` | Cumulative output ceiling across model steps |
| `ASSISTANT_MAX_CONTEXT_CHARS` | `48000` | Maximum assembled model context |
| `ASSISTANT_RUN_TIMEOUT_SECONDS` | `90` | End-to-end deadline |
| `ASSISTANT_TOOL_TIMEOUT_SECONDS` | `15` | Default individual tool deadline |
| `ASSISTANT_MAX_EDIT_OPS` | `20` | Maximum operations in one proposal |
| `ASSISTANT_MAX_EDIT_CHARS` | `30000` | Maximum total proposed replacement text |
| `RESEARCH_ENABLED` | `false` until configured | Separate research kill switch |
| `RESEARCH_MAX_RESULTS` | `5` | Maximum sources returned per call |
| `ALLOW_UNMETERED_LOCAL_AI` | `false` | Explicit local-only billing bypass |

`0` must not ambiguously mean both unlimited and disabled. Prefer separate
feature flags plus positive bounded limits. Configuration validation should
reject negative limits and unsafe production combinations.

### New platform budget controls

Add an atomic global platform token or credit budget in addition to the
existing request-count cap:

- Daily platform token/credit ceiling.
- Optional monthly platform token/credit ceiling.
- Per-user daily assistant-run ceiling.
- Separate daily research-call or research-cost ceiling.
- Separate embedding/query-indexing ceiling if embeddings remain a paid
  provider operation.

Reserve global capacity before each paid model step, then reconcile it using
actual usage. This must be atomic across service instances. A process-local
counter is not a hard spending limit.

Every model step in a tool loop must have a deterministic idempotency key, for
example `runId:modelStep:N`. Do not use one reservation for unrelated model
calls unless creditProxy explicitly introduces a run-level reservation model.

Cancellation policy must be defined and tested. On disconnect or timeout:

- Cancel the upstream provider request when possible.
- Commit known usage if the provider reports it.
- Do not automatically release a reservation when the provider may have
  completed and billed the request but usage is unknown.
- Record an auditable `usage_unknown` state and use a conservative bounded
  reconciliation policy.

### Local Ollama profile

The integrated local stack should make Ollama selection explicit in
`creditProxy`, not in the frontend or agent service:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=<developer-selected-model>
ALLOW_UNMETERED_LOCAL_AI=true
```

The exact base URL may differ outside Docker. Keep it server-side and document
the supported integrated-stack value.

Local behavior:

- Still emit usage and latency metadata when Ollama reports it.
- Record a `local_generate` ledger event with zero platform credits if local
  unmetered mode is enabled.
- Still apply all assistant run and token ceilings.
- Use the mock provider for deterministic unit/integration tests.
- Reject agent mode clearly when the selected Ollama model cannot produce the
  required tool-call format. Do not silently parse arbitrary prose as a tool
  call.

Prefer adding a metered `/v1/embed` path to creditProxy so hosted and local
embeddings follow the same provider and budget boundary. If that is deferred,
the embedding path must receive an equivalent atomic usage limit and local
Ollama embedding option.

## Security invariants

These requirements apply in every phase, including local development.

### Identity and authorization

- Derive user identity from a verified Firebase token; never trust a body
  `userId` or model tool argument.
- Bind the active story and chapter to server-verified ownership before any
  tool executes.
- Inject authorized story/user IDs into tool execution context. Do not expose
  them as freely selectable model arguments when avoidable.
- Keep production service-to-service OIDC and caller allowlists.
- Make read failures for unowned stories indistinguishable from not-found.

### Secrets

- Provider keys remain encrypted in the existing BYOK storage and are decrypted
  only on the trusted server path.
- Never send BYOK keys to assistant-ui, persist them in threads, include them in
  traces, or log request bodies containing them.
- Never allow a user-supplied Ollama/provider base URL.
- Keep story-data service tokens and database credentials outside browser code.

### Model and content safety

- Treat story text, web pages, tool results, citations, and provider responses
  as untrusted data, not instructions.
- Keep the available tool list server-owned and allowlisted.
- Validate tool arguments at both orchestration and execution boundaries.
- Cap argument size, result size, operation count, redirects, and response
  bytes.
- Return plain text or validated TipTap JSON for editor proposals; never apply
  model-provided raw HTML without sanitization.
- Do not expose a generic SQL, HTTP fetch, filesystem, shell, or code-execution
  tool.

### Research and SSRF

- Use a configured search provider or a dedicated safe fetcher.
- Allow only `https` and, where necessary, `http` public destinations.
- Block loopback, link-local, private, metadata-service, and internal service
  addresses before and after redirects and DNS resolution.
- Limit redirects, download bytes, content types, and request duration.
- Do not follow instructions embedded in fetched pages.
- Preserve source URLs and do not invent citations.

### Mutations

- Require explicit approval for every content mutation.
- Show the exact before/after diff before approval.
- Apply active-editor changes as one TipTap transaction so Undo reverses them.
- Refuse stale proposals rather than rebasing silently.
- Use `If-Match` for server-side story-data mutations.
- Audit successful writes using IDs, counts, and lengths—not manuscript text.

### Logging and observability

- Remove the current full-prompt info log before wider testing.
- Do not log prompts, selected prose, complete tool results, BYOK keys, or
  chapter bodies in normal logs.
- Log correlation IDs, user/story hashes where appropriate, tool names,
  durations, sizes, usage, model, status, and error codes.
- Redact headers and structured fields at the logging boundary.

## Phased implementation plan

Each task below is intentionally small enough to assign independently. An agent
working a task should read the applicable repository `AGENTS.md`, avoid changing
unrelated repositories, and leave contract or dependency changes documented.

### Phase 0 — Baseline, decisions, and safety fixes

Goal: freeze the intended boundaries and remove known hazards before adding an
agent loop.

#### P0-T1: Record the current behavior

Repository: `taleTribe-frontend`, `taleTribe-agents`

- Add or confirm integration tests for starting a chat, loading history,
  sending a message, clearing a thread, quota refusal, and provider failure.
- Capture current request/response examples without real story content or keys.
- Document which tests will be replaced versus retained as regression coverage.

#### P0-T2: Remove sensitive prompt logging

Repository: `taleTribe-agents`

- Remove the full `chatWithContext` prompt from info logs.
- Replace it with bounded metadata such as context characters, excerpt count,
  prompt estimate, provider, model, duration, and correlation ID.
- Add a test or logging assertion that story prose and BYOK keys are absent.

#### P0-T3: Choose the assistant runtime and stream topology

Repository: architecture-only spike across frontend/functions/agents

- Prototype assistant-ui Custom Runtime/Assistant Transport using mock events.
- Verify Vite compatibility and whether `@assistant-ui/vite` is needed for the
  chosen toolkit pattern.
- Test SSE or the chosen stream protocol through the current Firebase gateway.
- Verify cancellation reaches the agent when the browser closes the panel.
- Record an ADR selecting the transport and authenticated gateway shape.

#### P0-T4: Add rollout flags

Repository: frontend/functions/agents

- Define separate flags for rendering the new UI, accepting the new API, edit
  proposals, research, and legacy-chat fallback.
- Server flags must be authoritative; frontend flags only control presentation.
- Default new capabilities off outside explicit development configuration.

Phase gate:

- The transport choice is written down.
- Existing behavior is covered sufficiently to detect accidental regressions.
- Full prompts and secrets are not logged.
- New endpoints and mutation capabilities are off by default.

### Phase 1 — Versioned assistant contracts

Goal: let frontend, agents, and creditProxy work proceed without guessing each
other's message and event shapes.

#### P1-T1: Define message and stream schemas

Repository: `taleTribe-agents` with a generated/checked frontend client

- Specify run commands, message parts, tool-call parts, source parts, usage,
  approvals, terminal states, and safe errors in OpenAPI/JSON Schema.
- Include protocol versioning and an unsupported-version error.
- Define reconnect/resume semantics and event IDs if SSE is selected.

#### P1-T2: Define tool schemas

Repository: `taleTribe-agents`

- Define strict schemas for the initial read tools, `research_web`, and editor
  proposals.
- Keep execution context fields such as verified user ID out of model-owned
  arguments.
- Add size and count limits to the schema and to runtime validation.

#### P1-T3: Define provider-neutral model contracts

Repository: `creditProxy`

- Add a versioned chat request containing role-based messages, tool schemas,
  tool-choice policy, output ceiling, temperature, and idempotency key.
- Define normalized text deltas, tool-call deltas, final usage, provider/model,
  finish reason, and errors.
- Keep the legacy `/v1/generate` contract until all existing AI features are
  migrated or explicitly left on the compatibility path.

#### P1-T4: Contract fixtures

Repository: frontend/agents/creditProxy

- Create shared sanitized fixtures for a text-only response, one tool round,
  multiple tools, approval pause/resume, research citations, cancellation,
  provider error, and stale edit.
- Verify each consumer against the fixtures in CI.

Phase gate:

- Contract fixtures round-trip in TypeScript, Python, and Go.
- Unknown fields and versions follow an explicit compatibility policy.
- No secret or authorization decision can be supplied by a model tool call.

### Phase 2 — creditProxy agent-capable transport and hard budgets

Goal: support streaming messages and tool calls without weakening the existing
billing boundary.

#### P2-T1: Add mock chat/tool provider

Repository: `creditProxy`

- Implement the new contract first against a deterministic mock provider.
- Support scripted text deltas, tool calls, usage, failures, delays, and
  cancellation.
- Make all later integration tests runnable without paid inference.

#### P2-T2: Preserve billing for streamed model steps

Repository: `creditProxy`

- Reserve credits before opening a paid provider stream.
- Commit actual usage on success.
- Release only when failure is known to have occurred before billable work.
- Implement and test the conservative unknown-usage cancellation policy.
- Keep reservation, commit, release, and ledger writes idempotent.

#### P2-T3: Add atomic global spend budgets

Repository: `creditProxy`

- Keep the current global daily request cap.
- Add atomic daily token/credit capacity for platform-funded calls.
- Optionally add an atomic monthly ceiling.
- Return a distinct safe error for global budget exhaustion.
- Add a global kill switch that refuses platform-funded inference while still
  allowing configured local/mock and BYOK paths.

#### P2-T4: Implement Ollama chat/tool support

Repository: `creditProxy`

- Move Ollama from prompt-only generation to the normalized chat/tool contract.
- Stream when Ollama and the selected model support it.
- Report actual prompt/completion counts when available.
- Add validated local-unmetered mode and a `local_generate` audit event.
- Fail clearly when the chosen model cannot meet required structured tool-call
  behavior.

#### P2-T5: Implement hosted providers incrementally

Repository: `creditProxy`

- Implement Gemini, OpenAI, and Anthropic adapters behind the same contract.
- Normalize tool calls, finish reasons, token usage, errors, and cancellation.
- Test malformed and adversarial provider responses.
- Confirm BYOK requests skip platform credits but still obey operational limits.

#### P2-T6: Bring embeddings under a budget boundary

Repository: `creditProxy`, then `taleTribe-agents`

- Prefer a normalized embedding endpoint with hosted, Ollama, and mock adapters.
- Meter platform embeddings or enforce a separate atomic indexing/query budget.
- Preserve the required vector dimension contract and fail loudly on mismatch.
- Do not permit a browser-selected embedding provider URL.

Phase gate:

- Mock and Ollama complete a streamed tool-call round trip.
- Every paid model step reserves and reconciles credits.
- Global token/credit exhaustion stops new paid work atomically.
- BYOK keys do not appear in storage or logs.
- Cancellation and unknown usage have tested financial behavior.

### Phase 3 — Read-only story agent and streaming run loop

Goal: replace the one-shot `chatWithContext` prompt with a bounded tool-calling
orchestrator, initially without mutations or web access.

#### P3-T1: Add the assistant run endpoint

Repository: `taleTribe-agents`

- Accept the versioned run command and emit the selected streaming protocol.
- Derive user identity from the trusted caller context.
- Validate story ownership before starting the model.
- Propagate cancellation and deadlines to tools and creditProxy.

#### P3-T2: Implement bounded orchestration

Repository: `taleTribe-agents`

- Add a provider-neutral model/tool loop using only creditProxy.
- Enforce per-run model calls, tool calls, output tokens, context size, timeout,
  and concurrency.
- Use deterministic step idempotency keys.
- Stop with a clear partial-result state when a ceiling is reached.

#### P3-T3: Port and register read tools

Repository: `taleTribe-agents`, `story-data` only if an endpoint is missing

- Reuse the MCP read semantics but invoke `story-data` for canonical records.
- Add deterministic entity lookup and chapter-window reads.
- Keep semantic search story-scoped and owner-authorized.
- Return structured story references with IDs and bounded previews.

#### P3-T4: Improve retrieval routing

Repository: `taleTribe-agents`

- Use entity tools for named facts and semantic search for prose questions.
- Include the active editor selection/buffer when it is newer than persistence.
- Make index lag visible rather than presenting stale material as current.
- Preserve the rule that authored content is data, never instructions.

#### P3-T5: Compatibility endpoint

Repository: `taleTribe-agents`, frontend Functions

- Keep `chatWithContext` temporarily for legacy callers or adapt it internally
  to one read-only run.
- Do not add new functionality to the old plain-string contract.
- Add usage comparison tests to prevent a new assistant turn from making
  unbounded model calls.

Phase gate:

- The mock provider answers story questions through observable tools.
- Character, place, plot, and chapter questions cite story references.
- No registered tool can mutate data or access the public web.
- Run ceilings, authentication, ownership, cancellation, and quota failures are
  covered by tests.

### Phase 4 — assistant-ui frontend foundation

Goal: replace the custom panel for read-only conversations while preserving the
old implementation behind a fallback flag.

#### P4-T1: Install and pin assistant-ui

Repository: `taleTribe-frontend`

- Add the smallest required assistant-ui packages and pin a compatible version.
- Confirm React 19 and Vite production builds.
- Record upgrade guidance because runtime and toolkit APIs evolve.

#### P4-T2: Build the Inkwell assistant shell

Repository: `taleTribe-frontend`

- Replace `Chatbot` internals with assistant-ui thread/composer primitives.
- Preserve the existing floating trigger initially.
- Style messages, composer, tool states, focus, mobile layout, and dark mode
  using existing Inkwell tokens.
- Meet keyboard, focus-trap, screen-reader, and reduced-motion requirements.

#### P4-T3: Connect the authenticated runtime

Repository: `taleTribe-frontend`, Firebase Functions/gateway

- Attach the Firebase ID token through the existing trusted path.
- Connect message send, streaming, cancellation, retry, and safe errors.
- Do not put provider credentials or story-data service tokens in runtime
  configuration.

#### P4-T4: Render structured parts

Repository: `taleTribe-frontend`

- Add custom tool cards for story search, entity reads, and chapter reads.
- Render story-reference chips that navigate to the relevant editor tab or
  chapter where possible.
- Add visible usage/quota feedback without treating client counters as
  authoritative.

#### P4-T5: Test read-only UX

Repository: `taleTribe-frontend`

- Unit-test adapters and message-part renderers.
- Add Cypress coverage for open/close, stream, cancel, retry, mobile layout,
  quota exhaustion, provider failure, and story switching.
- Confirm switching stories cannot leak the previous story's thread or tools.

Phase gate:

- The new assistant can replace the old UI behind a flag.
- It streams read-only answers and tool activity from mock/Ollama.
- Story switching, authentication loss, cancellation, and errors are safe.
- `yarn lint`, `yarn test`, and `yarn build` pass.

### Phase 5 — Active editor context and approved edits

Goal: let the assistant understand and safely modify the current TipTap buffer.

#### P5-T1: Create an EditorBridge

Repository: `taleTribe-frontend`

- Expose a narrow interface around the active TipTap editor rather than passing
  the editor instance through unrelated assistant components.
- Provide story/chapter IDs, persisted revision, dirty state, document version,
  selection, selected plain text, and bounded current content.
- Increment document version on every relevant editor transaction.
- Clear the bridge synchronously on chapter/story change and unmount.

#### P5-T2: Add current-editor reads

Repository: frontend and agents

- Let the agent request the current selection or bounded active buffer through
  a scoped frontend tool/result.
- Require the tool's story and chapter to match the server-authorized run.
- Cap returned text and strip unsupported/private editor metadata.

#### P5-T3: Generate edit proposals

Repository: `taleTribe-agents`

- Register `propose_editor_edit` with strict operations and size limits.
- Begin with selected-text replacement.
- Add insert-at-cursor after replacement is stable.
- Add multi-operation and whole-chapter proposals only after stale detection and
  diff UX are proven.

#### P5-T4: Render diff and approval UI

Repository: `taleTribe-frontend`

- Show summary, before/after text, operation count, affected chapter, and any
  deletion clearly.
- Provide Apply, Reject, Copy, and Ask for revision actions.
- Use assistant-ui human/approval mechanics so the run can resume with the
  user's decision.
- Never interpret closing the panel as approval.

#### P5-T5: Apply one safe TipTap transaction

Repository: `taleTribe-frontend`

- Revalidate chapter, document version, range, and original text.
- Sanitize/parse the replacement as plain text or validated TipTap JSON.
- Apply all accepted operations in one transaction, from the end of the
  document backward when ranges are positional.
- Preserve Undo and trigger the normal autosave pipeline.
- Flush or visibly track the resulting save and handle a story-data `409`
  without hiding local content.

#### P5-T6: Editor edit tests

Repository: frontend/agents

- Cover selection replacement, insertion, deletion, undo, autosave, rejected
  proposal, stale document, chapter switch, overlapping operations, invalid
  ranges, huge output, unsupported markup, and revision conflict.
- Fuzz operation validation with malformed model arguments.

Phase gate:

- A writer can request a selected-text rewrite, review it, apply it, undo it,
  and see it save through story-data.
- No edit applies without approval or against stale editor state.
- The model cannot inject arbitrary HTML or bypass edit limits.

### Phase 6 — Bounded research with citations

Goal: let the assistant research external information without becoming an SSRF
proxy or creating uncontrolled third-party spend.

#### P6-T1: Choose and abstract the research provider

Repository: `taleTribe-agents`

- Define a provider-neutral search interface.
- Support a deterministic fake for tests and one configured real provider.
- Keep provider credentials server-side.
- Document cost characteristics and whether calls are billed separately from
  LLM usage.

#### P6-T2: Implement safe search/fetch

Repository: `taleTribe-agents`

- Enforce the SSRF, redirect, timeout, byte, content-type, and result limits in
  the security section.
- Normalize title, canonical URL, publisher, date, excerpt, and retrieval time.
- Treat all retrieved content as untrusted.

#### P6-T3: Add research budgets

Repository: agents/creditProxy or the service that owns research billing

- Enforce per-run and per-user research ceilings.
- Add a global daily research cap or cost budget.
- Emit audit/usage events without storing page bodies.
- Make research independently disableable while story chat remains available.

#### P6-T4: Render and persist citations

Repository: frontend and thread persistence owner

- Render source cards and inline reference markers.
- Persist normalized references with the answer.
- Open links safely with appropriate `rel` attributes.
- Distinguish external research from the story's own canon.
- Never display a model-invented URL as a verified source.

#### P6-T5: Research-to-editor handoff

Repository: frontend/agents

- Let the writer ask for a sourced answer, then separately request an edit
  proposal based on it.
- Preserve references in the assistant message.
- Do not insert research text automatically or copy large source passages.

Phase gate:

- Research can be disabled instantly.
- Every factual research answer exposes its supporting sources.
- Network targets and costs remain bounded.
- Research never changes the manuscript without a separate approved proposal.

### Phase 7 — Durable threads, story-data writes, and legacy cleanup

Goal: settle ownership of assistant state and remove the old split architecture.

#### P7-T1: Add durable assistant threads

Recommended owner: `story-data` for durable story-scoped records; agents owns
ephemeral run execution.

- Store threads, rich message parts, tool calls/results, sources, approvals,
  run status, and usage metadata.
- Scope every record to the authenticated owner and story.
- Do not store BYOK keys, full provider requests, or hidden reasoning.
- Add retention/deletion behavior and cascade cleanup when a story is deleted.

Because there is no production data requirement, create the final schema and
reset development chat data rather than writing a legacy migration.

#### P7-T2: Implement assistant-ui thread adapters

Repository: frontend/story-data

- Add list, create, load, rename, archive/delete, and pagination behavior.
- Prevent one story's threads from appearing in another story.
- Define behavior for deleted chapters and stale tool references.

#### P7-T3: Port optional backend writes to story-data

Repository: `taleTribe-agents`, `story-data`

- Port the useful MCP edit semantics away from Firestore.
- Use story-data DTOs, ownership, revision tokens, and `If-Match`.
- Add approved tools for inactive-chapter or worldbuilding updates only after
  active-editor edits are stable.
- Keep read and write paths on the same canonical system.

#### P7-T4: Remove legacy chat implementation

Repository: frontend/functions/agents

- Remove the old `Chatbot`, Zustand chat state, direct Firestore assistant-chat
  reads, and plain-string response types once fallback is no longer needed.
- Remove `sendChatMessage`/`clearChatSession` or leave explicit compatibility
  shims only for remaining callers.
- Delete obsolete Firestore rules and indexes only after verifying no book-club
  or other realtime chat uses them.

#### P7-T5: Naming and documentation cleanup

Repository: all touched repositories

- Replace any remaining legacy-brand assistant copy with TheTaleTribe.
- Update OpenAPI, `.env.example`, architecture docs, runbooks, security docs,
  and local-stack instructions.
- Document how to select mock, Ollama, platform, and BYOK modes.

Phase gate:

- Rich threads reload with tool calls, approvals, citations, and usage intact.
- No assistant state depends on legacy Firestore chat collections.
- All assistant writes use story-data and revision protection.
- The integrated local stack starts in Ollama or mock mode without paid keys.

### Phase 8 — Hardening and rollout

Goal: prove the system is secure, bounded, observable, and maintainable before
making it the only editor assistant.

#### P8-T1: Cross-service end-to-end suite

- Run the integrated stack with mock and Ollama.
- Cover question answering, entity lookup, semantic retrieval, research,
  selection rewrite, approval, rejection, undo, autosave, thread reload,
  cancellation, and story switching.
- Test credit exhaustion, global budget exhaustion, run ceiling, rate limit,
  provider timeout, research timeout, index lag, and story-data conflict.

#### P8-T2: Security testing

- Test IDOR attempts across users/stories/chapters/threads.
- Test prompt injection in stories and web pages.
- Test SSRF targets including loopback, private ranges, metadata IPs, redirects,
  alternative IP encodings, and DNS changes.
- Test tool argument injection, oversized parts, malformed streams, raw HTML,
  stale proposals, repeated approvals, and replayed idempotency keys.
- Verify logs and stored messages contain no secrets.

#### P8-T3: Cost and load testing

- Prove model/tool/run ceilings under adversarial loops.
- Prove global budget enforcement across multiple gateway instances.
- Verify reservations reconcile for success, failure, disconnect, timeout, and
  unknown usage.
- Measure default context size, model calls per successful turn, tokens per
  task type, research calls, and embedding calls.
- Start with conservative hosted-provider limits and raise them only from
  observed usage.

#### P8-T4: Accessibility and UX review

- Test keyboard-only editing and approval.
- Announce streaming/tool/approval states to assistive technology without
  excessive live-region noise.
- Verify mobile viewport, focus restoration, reduced motion, long messages,
  long diffs, and source-card readability.

#### P8-T5: Flagged rollout and removal

- Enable for maintainers with mock/Ollama first.
- Enable hosted-provider use for a small allowlist with low hard budgets.
- Monitor errors, latency, average calls per run, credits, cancellations, stale
  edits, approval rate, and research use.
- Remove the legacy fallback only after a stable observation period.

Final gate:

- Security and cost test matrices pass.
- A hard global platform budget and kill switch are verified.
- All paid inference and embeddings use creditProxy or an equally atomic budget
  boundary approved in the architecture decision.
- The user can ask about story canon, research with sources, and safely apply or
  reject editor changes.

## Dependency graph and parallel work

```text
Phase 0
   |
Phase 1 contracts
   |------------------------------|
   v                              v
Phase 2 creditProxy          Phase 4 UI shell with mock fixtures
   |                              |
   v                              |
Phase 3 agent run loop <----------|
   |
   +-----------> Phase 5 editor actions
   |
   +-----------> Phase 6 research
                       |
                       v
               Phase 7 persistence/cleanup
                       |
                       v
               Phase 8 hardening/rollout
```

Good independent work packages after Phase 1:

- creditProxy mock/stream contract.
- creditProxy atomic global budget.
- Ollama adapter.
- Hosted-provider adapters, one provider per task.
- Agent read tools and authorization.
- Agent run-limit enforcement.
- assistant-ui Inkwell components using fixtures.
- EditorBridge and snapshot tests.
- Diff/approval component using fixtures.
- Research provider abstraction and fake.
- Research safe-fetch/SSRF suite.
- Durable thread schema and API.

Avoid assigning the same shared contract files to multiple agents at once.
Land contract changes first, then have downstream tasks consume a pinned
version or commit.

## Verification matrix

Each repository keeps its existing required checks. New cross-service behavior
also needs the integrated stack.

| Area | Required verification |
| --- | --- |
| Frontend | `yarn lint`, `yarn test`, `yarn build`, targeted Cypress flows |
| Firebase Functions | Functions build/tests, auth and streaming integration tests |
| taleTribe-agents | Ruff/format checks, pytest, contract fixtures, tool and security tests |
| story-data | `go test ./...`, API conflict/ownership tests, migration validation |
| creditProxy | `go test ./...`, health check, reserve/commit/release/BYOK/local/cancellation tests |
| Integrated | Workspace `./dev-new.sh`, signed-in editor flows with mock and Ollama |

No test should require a paid provider by default. Hosted-provider smoke tests
must be opt-in, tightly capped, and skipped when credentials are absent.

## Definition of done

The overhaul is complete when:

- The custom editor chat UI and its plain-string protocol are removed.
- assistant-ui renders streaming text, tools, approvals, sources, errors, and
  durable threads in the Inkwell design system.
- Story questions use deterministic records and/or cited semantic excerpts.
- The active unsaved editor buffer can participate in a run without becoming
  a server-side source of truth.
- Selected-text and bounded chapter edits are previewed, explicitly approved,
  applied as undoable TipTap transactions, and saved with conflict handling.
- Research answers show real normalized sources and obey SSRF and cost limits.
- Every model step routes through creditProxy; local development uses Ollama or
  mock through the same boundary.
- Platform, BYOK, local, and mock modes have explicit, tested billing behavior.
- Per-user, per-run, global, research, context, output, timeout, and concurrency
  limits are server-enforced and configurable.
- The hard global spend ceiling and kill switch work across multiple instances.
- Prompts, story bodies, research bodies, and keys do not leak into normal logs.

## References

- [assistant-ui: choosing a runtime](https://www.assistant-ui.com/docs/runtimes/pick-a-runtime)
- [assistant-ui: custom runtimes](https://www.assistant-ui.com/docs/runtimes/custom/overview)
- [assistant-ui: Assistant Transport](https://www.assistant-ui.com/docs/runtimes/custom/assistant-transport)
- [assistant-ui: defining tools](https://www.assistant-ui.com/docs/tools/defining-tools)
- [assistant-ui: interactive tool and approval UI](https://www.assistant-ui.com/docs/tools/tool-ui)
- [assistant-ui: Google ADK runtime](https://www.assistant-ui.com/docs/runtimes/google-adk/overview)
- [TipTap content commands](https://tiptap.dev/docs/editor/api/commands/content)
- [TipTap `insertContentAt`](https://tiptap.dev/docs/editor/api/commands/content/insert-content-at)
