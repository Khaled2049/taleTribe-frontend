# Assistant Phase 4 implementation plan: read-only product UI

Date: 2026-09-12. Status: implemented on `feature/assistant-ui`. Scope: P4-T1 through P4-T5 of
[the integration plan](assistant-ui-integration.md#phase-4--assistant-ui-frontend-foundation),
plus one deterministic-mock preflight needed by the phase gate. Predecessor:
[Phase 3](assistant-ui-phase-3-plan.md), implemented on
`feature/assistant-phase-3-run-loop`.

Phase 4 turns the transport preview into the real read-only assistant panel. It
does not add new agent powers. The browser renders the text, tool activity,
story references, usage, partial completion, and safe failures that Phase 3
already emits.

The main rule for this phase is separation: assistant-ui owns interaction and
rendering, the v1 contracts own event interpretation, and the gateway/agents
remain the only authorization and execution boundary.

## What is already implemented

The original Phase 4 task list assumed that the frontend had no assistant-ui
runtime yet. Phase 0 and Phase 3 moved several prerequisites forward:

- `@assistant-ui/react` is already pinned at `0.15.18`. React 19 and the Vite 6
  production build are proven without `@assistant-ui/vite`.
- `AssistantStreamSpike.tsx` already uses `useLocalRuntime`, a
  `ChatModelAdapter`, authenticated POST, SSE parsing, and abort propagation.
  It now calls the real `assistantRun` relay, but renders text only.
- `@novelsync/assistant-contracts` validates every v1 event, enforces stream
  ordering and terminal events, and exposes `applyEvent`/`RunState`.
- Phase 3 emits observable read-tool events, story references, per-model-call
  usage, safe failures, and `finishReason: "max_steps"`.
- `FloatingChatButton` already selects the new or legacy UI using presentation
  flags, and keys the preview by `storyId`.
- The legacy `Chatbot`, `ChatContext`, history, and clear behavior remain intact
  as the fallback path.

That makes P4-T1 a stabilization task, not a package-install task. Do not add a
second assistant runtime or move model logic into React components.

## Preflight gap: the scripted mock is call-scoped, not run-scoped

The current creditProxy mock replays one fixture selected by a directive in the
last user message. A `single-tool-round` response therefore repeats on every
Phase 3 model step: after agents returns the tool result, the next `/v1/chat`
call sees the same directive and asks for the same tool again. The bounded loop
correctly ends at `max_steps`, but the Phase 4 gate cannot demonstrate a tool
call followed by a final answer.

Before the integrated UI test, add one deterministic two-step mock scenario in
`creditProxy`. It should emit an existing tool-call fixture before any tool
result is present and an existing text fixture after a `role="tool"` message is
present. Keep a separate repeating scenario for the `max_steps` test. This is
test-provider behavior only; it must not add state to the gateway or alter a
hosted provider.

The exact directive and fixture composition are implementation details. The
required test is: two requests with the same run prompt, the second containing
the first tool result, produce `tool_calls` and then `stop` respectively.

## Scope adjustment

- **No durable threads.** Keep one ephemeral transcript for the currently
  mounted story workspace. Closing and reopening may retain settled messages;
  route reload loses them. Phase 7 owns storage, thread lists, and reload.
- **No implied server memory.** The v1 request carries the current user message,
  not prior turns, and Phase 3 does not persist `threadId`. The UI may display an
  ephemeral transcript, but follow-up questions should not be presented as
  having durable conversational memory.
- **No editor buffer or mutations.** Do not send TipTap content in this phase,
  register browser-executable tools, show Apply controls, or expose approval
  UI. Phase 5 owns all of that.
- **No web research.** A future web source remains representable by the
  protocol, but Phase 4 does not enable or advertise research.
- **No automatic failover to legacy.** The flags choose one implementation
  before a request. A failed new-assistant request must not silently issue a
  second legacy model call.
- **No legacy cleanup.** Leave `Chatbot`, its Firestore history, and its tests
  unchanged. Phase 7 removes them after rollout evidence exists.
- **No production rollout claim.** The selected local first-party gateway has
  proven cancellation. Hosted routing and cancellation still need deployment
  evidence before the presentation flag is enabled in production.

## Design decisions

### 1. Keep LocalRuntime and replace the preview around it

Continue with the pinned `useLocalRuntime` + `ChatModelAdapter` path. Rename the
preview to a product component such as `AssistantPanel`, move transport/event
projection out of that component, and delete `AssistantStreamSpike.tsx` only
after its replacement passes the integrated stream and cancellation tests.

Keep the assistant bundle lazy-loaded from `FloatingChatButton`. The current
assistant-ui chunk is large but isolated; Phase 4 should not move it into the
initial application bundle.

The adapter is the only bridge between contracts and assistant-ui. UI
components receive assistant-ui message parts and small view metadata; they do
not switch over raw SSE event types.

### 2. Expand the protocol projection before building cards

`RunState` currently retains one text string, references, the last usage event,
and a terminal event. That is insufficient for a multi-step Phase 3 run.
Extend the generic projection in `packages/assistant-contracts` to retain:

- ordered tool calls keyed by `toolCallId`, including name, raw argument text,
  parsed arguments when complete, result, and failed/running/completed state;
- ordered story references;
- cumulative prompt tokens, completion tokens, and credits across every usage
  event, plus the number of billed model calls;
- the upstream provider/model/billing modes needed for bounded UI metadata;
- the terminal event and its exact finish reason; and
- settled versus currently streaming text.

`text.done` settles the current model-call segment. It must not erase text that
was emitted before an earlier tool round. `tool.args.delta` is accumulated as
raw text and only parsed when valid JSON is available; an incomplete fragment
is a normal streaming state, not an exception.

Keep this projection independent of React and assistant-ui. Fixture-driven
unit tests should prove parallel tool calls, split arguments, tool failure,
multiple usage frames, multiple text segments, references, and all terminal
states.

### 3. Translate v1 parts into display-only assistant-ui parts

The adapter produces cumulative `ChatModelRunResult.content` snapshots:

- assistant text becomes a `text` part;
- server-executed tools become `tool-call` parts with stable IDs, `argsText`,
  parsed args, result, and error state;
- story references become assistant-ui `source` parts using the document form;
  NovelSync-only fields such as snippet and story kind stay in bounded provider
  metadata; and
- usage and the protocol finish reason stay in message metadata rather than
  being inserted into the answer as model-authored text.

Do not register these tools with a client executor. Their assistant-ui parts
are an observable record of work already authorized and executed by agents.
An unknown future tool gets a generic read-only renderer, never dynamic code or
a browser fetch.

Map terminal states deliberately:

| v1 terminal | assistant-ui status / presentation |
| --- | --- |
| `stop` | complete |
| `length` | incomplete/length with retained partial text |
| `max_steps` | retained partial text plus a specific stopped-early notice |
| `run.cancelled` / local abort | cancelled, not a provider error |
| `run.failed` | incomplete/error with only the protocol's safe code/message |

Approval events are impossible while Phase 3 advertises read tools only. If
one arrives, fail closed with an unsupported-capability message; do not render
an approval button early.

### 4. The panel owns presentation; the story workspace owns lifetime

Use the existing Inkwell tokens and assistant-ui primitives for a product shell:
thread viewport, empty state/suggestions, user and assistant messages, composer,
send/cancel, copy/retry actions, and live tool status. Keep plain text rendering
in this phase; do not add raw HTML or a markdown renderer as part of the UI
migration.

Use the existing Radix dialog foundation (or an equivalent existing primitive)
for focus trapping, Escape-to-close, focus restoration, and modal semantics.
The panel is full-width on small screens and a right-side panel on larger
screens. Animations must respect `prefers-reduced-motion`.

The runtime lifetime is scoped to the mounted story workspace, not to the
dialog content:

- closing the panel aborts an in-flight run but may preserve completed local
  messages for reopening;
- changing `storyId` aborts first, then synchronously destroys the old runtime
  and transcript;
- authentication loss aborts, clears the ephemeral transcript, and closes the
  panel; and
- retry creates a new client message/run identity and never reuses a partially
  consumed stream.

This produces useful local continuity without creating a second persistence
system or allowing one story's transcript to appear in another.

### 5. Navigation is allowed only when the target is deterministic

Tool cards can navigate from server-validated IDs:

- `read_chapter` can open the editor and identify the chapter;
- `get_story_entity` can open the Character, Place, or Plot workspace using its
  validated kind; its entity ID is carried only if that destination supports a
  stable selection contract; and
- overview/list tools can open the corresponding workspace tab.

The current editor and worldbuilding tabs have no general item deep-link
contract, and semantic search references identify a vector chunk rather than
always exposing a canonical route target. Those references remain
non-destructive chips with a title/snippet when navigation cannot be resolved
honestly. Do not infer a route from display text. Adding stable deep-link state
is a separate small task if the destination cannot select an item by ID safely.

### 6. Feature fallback is a rollout choice

Keep the existing selection semantics:

```text
new UI flag on             -> AssistantPanel
new UI flag off + fallback -> legacy Chatbot
both off                   -> no assistant trigger
```

The server flags remain authoritative. Client flags may reveal a UI but never
authorize tools. Keep the new presentation flag development-only until the
hosted gateway path has verified end-to-end cancellation; do not treat the
Firebase function toggle as proof of that property.

## Tasks

### P4-T1: stabilize assistant-ui and build the run projection

Repository: `taleTribe-frontend`.

- Confirm and retain the exact `@assistant-ui/react` version already installed;
  add no toolkit package unless a concrete API requires it.
- Expand `RunState`/`applyEvent` per decision 2.
- Add a pure conversion from projected run state to assistant-ui content and
  message status/metadata.
- Sum usage frames instead of keeping only the last model call.
- Cover the conversion with the existing v1 fixtures plus a multi-usage,
  multi-text-segment test.

This task lands before component work so rendering cannot invent a second
event reducer.

### P4-T2: build the Inkwell assistant shell

Repository: `taleTribe-frontend`.

- Replace the preview component with the production-named read-only panel.
- Preserve the floating trigger and lazy-loaded boundary.
- Compose thread, message, empty-state, action-bar, and composer primitives.
- Add accessible dialog/focus behavior, responsive layout, dark-mode token use,
  and reduced-motion behavior.
- Present supported suggestions without implying edit or research capability.
- Preserve completed local messages across a close/reopen while the same story
  workspace remains mounted.

The precise visual composition is intentionally left to the implementation
agent; the accessibility and lifecycle invariants are the acceptance criteria.

### P4-T3: extract and connect the authenticated runtime

Repository: `taleTribe-frontend`, including the existing Functions/gateway
surface only if a transport correction is required.

- Move endpoint resolution, Firebase token acquisition, `buildRunRequest`, SSE
  reading, and error classification into a focused transport/adapter module.
- Send only the v1 browser request. Never send `userId`, provider credentials,
  story-data tokens, prior tool results, or arbitrary environment configuration.
- Retain active abort handling through token acquisition, fetch, stream read,
  Stop, panel close, story change, and sign-out.
- Map safe pre-stream HTTP errors and in-stream `run.failed` events without
  exposing upstream bodies.
- Make retry a fresh request with a fresh `clientMessageId`.
- Keep hosted selection explicit and default-off until cancellation is observed
  through the deployed path.

### P4-T4: render tools, references, usage, and partial completion

Repository: `taleTribe-frontend`.

- Add compact read-tool cards for overview, entity list/read, semantic search,
  chapter reads, and current-editor availability.
- Show running, completed, failed, truncated, and stale states. A stale search
  result must be visually distinguishable from current canonical data.
- Add a generic safe fallback card for unknown read tools.
- Render bounded story-reference chips and deterministic workspace navigation
  per decision 5.
- Show cumulative usage from server events. Label it as usage for this response,
  not an authoritative account balance.
- Give `max_steps`, output-length completion, quota refusal, rate limiting,
  provider failure, and malformed stream distinct safe presentations.
- Add copy and retry actions; do not add approval or Apply controls.

### P4-T5: test the read-only UX and retire preview naming

Repositories: `taleTribe-frontend`; `creditProxy` for the preflight mock only.

Unit/fixture coverage:

- event projection and assistant-ui part conversion;
- split/parallel tool arguments and completed/failed tools;
- usage totals across model steps;
- `stop`, `length`, `max_steps`, cancellation, quota, and provider failures;
- authenticated request shape and absence of browser-supplied identity/secrets;
- story change/sign-out abort ordering; and
- deterministic reference navigation versus intentionally non-clickable chips.

Integrated Cypress coverage with the local first-party gateway:

- open, stream a text answer, close, and reopen;
- complete the run-aware mock tool-call-then-answer scenario and display its
  tool card/reference;
- Stop and panel-close cancellation, confirmed at the agent boundary rather
  than inferred only from button state;
- retry after a safe provider failure;
- quota refusal and `max_steps` partial-result presentation;
- switch between two owned stories and prove the first transcript/tool state is
  gone before the second can send;
- sign out during a run; and
- one narrow mobile viewport covering focus, composer reachability, and scroll.

Once those pass, remove preview-specific component names, data attributes, and
environment variables. Keep the legacy Cypress baseline because the fallback
still ships.

## Ordering

```text
creditProxy run-aware mock preflight
                |
                v
P4-T1 projection -> P4-T3 runtime ----\
          \------> P4-T2 shell -------> P4-T4 structured UI -> P4-T5 gate
```

T2 can begin from static fixtures once T1 fixes the view model. T3 can proceed
in parallel with shell styling. T4 needs both. The preview is deleted only in
T5 after the replacement passes cancellation and story-isolation tests.

Natural review boundaries are the run projection/runtime core, the shell and
structured renderers, then integrated coverage/preview cleanup. Keep the small
creditProxy mock change on its own dependency branch if the work continues as
stacked PRs.

## Phase gate

- With the new presentation flag on, the product panel streams a complete
  read-only mock run with observable tool activity, a final answer, and story
  references.
- With the flag off, the legacy assistant behaves exactly as before; no runtime
  error silently invokes both paths.
- Tool calls are display-only in the browser. No write, approval, web, generic
  HTTP, SQL, filesystem, shell, or code-execution capability is registered.
- Usage is cumulative across all model calls, and `max_steps` retains partial
  output with an honest stopped-early state.
- Close, Stop, story change, and authentication loss cancel the active run.
  Story switching synchronously clears all prior message/tool/reference state.
- Desktop/mobile layout, keyboard focus, screen-reader labels, dark mode, and
  reduced motion are verified.
- `yarn test`, Functions tests, contract checks, and `yarn build` pass. Changed
  files have zero lint errors.

The integration plan's original gate says the repository-wide `yarn lint` must
pass. The repository currently has many unrelated baseline failures, recorded
since Phase 0. Do not hide that fact or mix broad lint cleanup into this stack:
require no new errors and either restore the global gate in a separate cleanup
change or explicitly carry the known baseline in the verification record.
