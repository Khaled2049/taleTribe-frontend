# Assistant `/help` command implementation plan

Date: 2026-09-14. Status: proposed. Scope: an in-chat `/help` that tells the
writer what the assistant can do and which tools it has. Spans
`taleTribe-agents` (the catalog and its export) and `taleTribe-frontend` (the
generated contract and the panel). `story-data` and `creditProxy` are untouched.

Predecessor: [Phase 7](assistant-ui-phase-7-plan.md). This builds on the
shipped assistant path — `AssistantPanel` → `assistantRun` Function →
`POST /assistant/run` → six read tools plus `propose_editor_edit`.

## The problem `/help` actually has

"What can this thing do" is currently written down in four places, none of
which is a help text:

| Where | What it knows | Repo |
|---|---|---|
| `assistant/tools.py` → `available_tools()` | the real allowlist for a run, gated on `edits_enabled` / `research_enabled` | agents |
| `assistant/run.py` → `SYSTEM_RULES`, `EDIT_RULES`, `_model_tools()` | how the model is told to use them | agents |
| `AssistantPanel.tsx` → `READ_TOOL_NAMES`, `toolDetails()` | how a completed tool call is labelled for a human | frontend |
| `AssistantPanel.tsx` → `EmptyAssistant` suggestions | four example prompts | frontend |

A `/help` that hardcodes a fifth list drifts the first time a tool is added or
a flag flips. So the load-bearing part of this plan is not the command — it is
that the help catalog is **generated from the agents tool registry**, along the
pipeline that already exists:

```
assistant/tools.py  (pydantic, source of truth)
  → scripts/export_assistant_schema.py
  → assistant/schema/v1.json
  → scripts/sync_assistant_fixtures.py        (vendors into the frontend)
  → packages/assistant-contracts/scripts/generate.mjs
  → packages/assistant-contracts/src/generated/protocol.ts
```

Two facts the copy must respect:

- **`research_web` is not real.** The schema exists and `RESEARCH_TOOLS`
  registers it, but there is no executor, `run.py` hardcodes
  `research_enabled=False`, and `assistant_research_enabled` defaults to
  `False`. `/help` must not advertise web research.
- **`apply_editor_edit` is not a model tool.** It is synthesized for the
  browser approval round (`MODEL_EDIT_TOOLS` contains only
  `propose_editor_edit`). Help should describe the *capability* — "propose a
  revision you approve" — not two tool names.

## Design decisions

### 1. `/help` never leaves the browser

It is answered locally: no HTTP request, no Firebase token, no model call, no
credits, and no chance of the model hallucinating a tool it does not have.

The intercept point is `createAssistantAdapter.run` in
`src/components/chat/assistantRuntime.ts` — the single choke point every send
passes through, already holding the abort controller and the
`latestUserText(messages)` the command has to be parsed from. Doing it in the
composer's submit handler instead would miss `Reload`; doing it in
`assistantTransport.ts` would put a UI concern inside the transport.

### 2. Two ordering guards at the intercept

- **Continuation wins.** Compute `editorContinuationForMessage(...)` first; if
  a continuation exists, this run is an approval resume, not a fresh prompt, so
  never parse it as a command.
- **Intercept only exact matches.** `/help` and `/?` (case-insensitive,
  trimmed). Anything else starting with `/` is sent to the model as ordinary
  text — prose legitimately starts with a slash, and a typo'd `/helo` costing
  one cheap model call is better than a chat that silently eats input.

### 3. Render as a real assistant message, not a dialog

Build the result through `toAssistantRunResult(state)` with a hand-made
`RunState` so message metadata stays well formed: `runId: null`, `modelCalls:
0` — which `MessageMetadata` already reads, so the "N tokens · N credits" line
correctly does not render for a free local reply.

The content is a dedicated `HelpCard`, not a text paragraph: `PlainTextPart`
renders `whitespace-pre-wrap` plain text, which would turn a capability list
into a flat wall. The card is selected by a metadata discriminator
(`metadata.custom.novelsync.kind === "local_help"`) rather than by inventing a
client-only tool-call part — the parts vocabulary is the persisted protocol and
should stay server-owned.

### 4. Gating mirrors the runtime, not the schema

Each catalog entry carries a `gate` (`"always" | "edits" | "research"`). The
panel filters with the flag it already has, `EDITOR_ACTIONS_PRESENTED`
(`VITE_ASSISTANT_EDITOR_ACTIONS_ENABLED`), and drops `research` entirely while
the server hardcodes it off. A help text that lists a tool the run loop will
not offer is worse than no help text.

## Tasks

### H-T1: Help catalog in agents (agents)

New `assistant/help.py`. One module, no imports from `run.py`:

```python
@dataclass(frozen=True)
class Capability:
    id: str                 # stable key, e.g. "search_story"
    tools: tuple[str, ...]  # registered tool names this capability covers
    gate: Literal["always", "edits", "research"]
    title: str              # "Search the manuscript"
    summary: str            # one sentence, writer-facing, no tool jargon
    example: str            # a prompt the user can click to send
    limits: str | None      # e.g. "Up to 20 results per search."
```

`HELP_CATALOG: tuple[Capability, ...]` covering: story overview, entity list,
entity detail, manuscript search, chapter read, current-editor read, and (gated
`edits`) propose-a-revision, which names both `propose_editor_edit` and
`apply_editor_edit` in `tools`. Plus a short `HELP_PREAMBLE` and
`HELP_BOUNDARIES` — one line each on scope ("this story only"), persistence
("the conversation isn't saved"), and the hard no ("no web, no writes without
your approval"), so the boundaries the system prompt asserts and the help text
claims come from one string.

### H-T2: Export and pin it (agents)

- `scripts/export_assistant_schema.py`: add a top-level `"capabilities"` key —
  the catalog as a list of plain dicts, plus `preamble` / `boundaries`.
  Deliberately top-level next to `limits` and `approvalRequiredTools`, not
  inside `definitions`, because it is not JSON Schema.
- `tests/test_assistant_tools.py` (or a new `test_assistant_help.py`): assert
  every name in every `Capability.tools` is a key of `TOOL_SCHEMAS`, and that
  the union of those names covers `TOOL_SCHEMAS` exactly. Adding a tool without
  help copy then fails CI, which is the whole point of generating this.
- One more: assert no capability has `gate="research"` marked as shipped, or
  simply assert `research_web`'s capability is gated `research` — so the day it
  is implemented, turning the flag on is all it takes.

### H-T3: Sync (agents)

`python -m scripts.export_assistant_schema && python scripts/sync_assistant_fixtures.py`
— the schema is already a synced artifact, so the frontend copy updates with no
script change. Verify with `--check`.

### H-T4: Generate the typed catalog (frontend contracts)

`packages/assistant-contracts/scripts/generate.mjs`: emit
`export const CAPABILITIES = ... as const;` and the preamble/boundaries
alongside the existing `LIMITS` / `ERROR_CODES` constants, and export a
`Capability` type. `yarn assistant:contracts:check` then fails on a stale copy
exactly as it does today for the protocol types.

### H-T5: Command parsing (frontend)

New `src/components/chat/slashCommands.ts` — small and deliberately not a
framework:

```ts
export type SlashCommand = "help";
export function parseSlashCommand(text: string): SlashCommand | null;
```

Exact-match only (`/help`, `/?`), trimmed, case-insensitive. Kept in its own
module so it is unit-testable without React and so a second command later is an
entry in one map.

### H-T6: Local answer path (frontend)

New `src/components/chat/localHelpResult.ts`: `buildHelpRunResult({ editsEnabled })`
returns a `ChatModelRunResult` via `toAssistantRunResult`, with
`kind: "local_help"` and the filtered capability list on the metadata.

`assistantRuntime.ts`: after the continuation guard, if
`parseSlashCommand(prompt)` is `"help"`, `yield buildHelpRunResult(...)` and
`return` — inside the existing `try/finally` so the controller cleanup stays
identical for every path.

`AssistantMessageMetadata` in `assistantRunModel.ts` grows
`kind: "run" | "local_help"` (defaulting `"run"`) and an optional
`help: { capabilities, boundaries }` payload.

### H-T7: The card (frontend)

New `HelpCard` in `AssistantPanel.tsx` (or its own file if the panel's 1083
lines argue for it — it is already the largest file in `src/components/chat`).
Rendered from `AssistantMessage` when the metadata kind is `local_help`,
instead of the default part list.

Shape: title row, one-line preamble, then a capability list — each row a label,
a summary, its limit line, and a click-to-send example using
`ThreadPrimitive.Suggestion` so the examples are live, not decorative. Footer:
the boundaries line. Reuse the existing icon vocabulary already mapped per tool
in `toolDetails()` (`Library`, `Users`, `MapPin`, `ListTree`, `Search`,
`FileSearch`, `WandSparkles`) so a capability in help and the same tool in a
transcript look like the same thing. `data-cy="assistant-help"` for the e2e.

### H-T8: Discoverability (frontend)

`/help` is worthless if nobody knows to type it.

- `EmptyAssistant`: add a `["What can you do?", "/help"]` suggestion as the
  first chip.
- `Composer` footer: extend the existing hint to
  `Enter to send · Shift+Enter for a new line · /help for what I can do`.
- Optional, sized separately: a `/`-triggered autocomplete popover over the
  composer. Genuinely nice, but it means owning keyboard navigation and
  focus/aria over `ComposerPrimitive.Input`, which is several times the cost of
  everything above. Recommend shipping H-T1…H-T8 first and deciding after.

### H-T9: Tests

- agents `tests/test_assistant_help.py`: catalog/registry coverage (H-T2),
  every `example` non-empty and within `MAX_MESSAGE_CHARS`.
- frontend `tests/slashCommands.test.ts`: `/help`, ` /HELP `, `/?` match;
  `/helpme`, `hello /help`, `//help`, `""` do not.
- frontend `tests/assistantRuntime.test.ts`: a `/help` send yields a result
  with `kind: "local_help"` **and calls no fetcher** — the strongest assertion
  here is the negative one. Also: a message carrying a pending continuation is
  not intercepted even if its text is `/help`.
- frontend `tests/assistantRunModel.test.ts`: the help result's metadata has
  `modelCalls: 0` so no usage line renders.
- cypress `cypress/e2e/assistant_panel.cy.ts`: type `/help`, assert
  `[data-cy=assistant-help]` appears, assert `cy.get("@assistantRun.all")`
  stayed empty, and click an example to confirm it sends a real run.

### H-T10: Documentation

- `docs/assistant-ui-integration.md`: one paragraph — the command exists, it is
  local, and the catalog is generated.
- `taleTribe-frontend.wiki/Frontend-Agents-Integration.md` + `AI-API-Reference.md`:
  mention the `capabilities` block in `schema/v1.json`.
- Agents `CLAUDE.md` assistant paragraph: note that adding a tool now requires
  a `Capability` entry or the test fails.

## Ordering

H-T1 → H-T2 → H-T3 → H-T4 are a chain across two repos and should land as one
agents commit plus one frontend commit (the vendored schema and the regenerated
types belong in the same commit as the code that reads them). H-T5 → H-T6 →
H-T7 → H-T8 are independent frontend work on top. H-T9 alongside each. H-T10 last.

## Verification

```bash
# agents
cd repos/taleTribe-agents
python -m scripts.export_assistant_schema
python scripts/sync_assistant_fixtures.py
pytest tests/test_assistant_help.py tests/test_assistant_tools.py tests/test_assistant_contracts.py
python scripts/sync_assistant_fixtures.py --check

# frontend
cd repos/taleTribe-frontend
yarn assistant:contracts:generate && yarn assistant:contracts:check
yarn test && yarn typecheck && yarn lint
yarn cy:run --spec cypress/e2e/assistant_panel.cy.ts
```

## Risks

- **The catalog becomes marketing copy.** It is generated from the registry, so
  the tool list cannot drift — but the `summary` text can still overstate. Keep
  each one to what the executor in `assistant/executors.py` actually returns.
- **Free replies look like paid ones.** Mitigated by `modelCalls: 0` suppressing
  the usage line, and by the card being visually distinct from a normal answer.
- **A second local command invites a third.** The registry is intentionally a
  map with one entry; resist growing a command language before there is a
  second real command.
