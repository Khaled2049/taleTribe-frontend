# Assistant Phase 7 implementation plan: retire the legacy chat

Date: 2026-09-13. Status: in progress — the legacy cutover tasks are implemented
on `feature/assistant-ui`; durable threads and canonical story-data writes were
restored to scope on 2026-09-14. The transcript purge is blocked until durable
storage is live and any retained legacy conversations have been migrated. Scope:
Phase 7 of [the integration plan](assistant-ui-integration.md#phase-7--durable-threads-story-data-writes-and-legacy-cleanup).
Predecessor: [Phase 5](assistant-ui-phase-5-plan.md), implemented on
`feature/assistant-ui` across frontend, agents and creditProxy.

Phase 7 originally bundled four related cutover jobs. The first implementation
pass retired the legacy chat before durable assistant state was ready. The
remaining work now restores the intended end state: story-data owns threads and
messages, both assistant and MCP mutations use story-data, and the old
transcripts are removed only after that replacement is proven.

## Non-goals

Still deliberately **not** in this phase:

- Persisting an MCP client's surrounding chat transcript. The MCP server sees
  tool calls, not the client application's user/model messages.
- Removing the assistant's browser approval gate. Shared mutation semantics do
  not require assistant and MCP to have identical consent UX.
- Moving MCP OAuth tokens or the rollout allowlist out of Firestore. Story and
  chapter writes move to story-data; MCP identity infrastructure does not.

## Restored durable-state work

- **P7-T1 durable assistant threads:** add story-scoped thread and rich-message
  storage to story-data, including idempotency, pagination, status, metadata,
  revision guards, and cascade deletion.
- **P7-T2 assistant-ui thread adapters:** create/list/load/update/archive
  threads and rehydrate structured messages, tool calls, sources, and pending
  approvals.
- **P7-T3 canonical writes and capability parity:** port MCP writes from
  Firestore to story-data and have the MCP and assistant adapters share one
  capability catalog. Browser-only editor context remains an explicit channel
  extension.
- Enable MCP writes by default only after P7-T3 removes the split-brain guard;
  keep `stories:write`, ownership, revisions, limits, and the emergency kill
  switch.

## What is already implemented

- The assistant path works end to end: `AssistantPanel` → `/assistant-run`
  relay (or the `assistantRun` Function) → `POST /assistant/run` → six read
  tools and `propose_editor_edit` → creditProxy `/v1/chat`.
- `assistantFlags()` gates three server behaviours: `api`, `edits`, and
  `legacy`. `sendChatMessage` already refuses with 404 when `legacy` is false,
  so the kill switch exists and is tested.
- `FloatingChatButton` already chooses between the two implementations, so the
  cutover is a deletion rather than a rewrite.

## Preflight gaps

These are the reasons "delete `Chatbot.tsx`" is not a one-commit job. Each one
is something the legacy path does that the assistant path does not.

### 1. The assistant path has no per-user daily quota

`sendChatMessage` calls `checkAiAccess(userId)` and refuses with 429 when the
`MAX_AI_USAGE` daily counter is spent. `assistantRun` checks the flags and
story ownership and nothing else. creditProxy still meters credits and the
platform daily request cap still applies, so this is not an unbounded-spend
hole — but the per-user daily ceiling that exists today disappears with the
legacy endpoint, and the Firestore `users/{uid}.aiUsage` counter stops being
written for conversational AI.

**Decision: port `checkAiAccess` into `assistantRun` before deleting anything.**
It is a four-line addition at a boundary that already resolves `userId`.

### 2. BYOK does not reach the assistant path

The legacy path forwards `provider_config` through `agent/client.ts`, so a user
with their own key spends no platform credits. `assistantRun` never reads
`users/{uid}.aiSettings`; every assistant run today bills the platform. Deleting
the legacy chat would therefore silently start charging BYOK users for a feature
they had configured to be free.

**Decision: forward BYOK on the assistant path in this phase.** The agent side
already understands `provider_config` (the `_byok_config` ContextVar), so the
work is confined to the Function and the run request.

### 3. Conversations previously stopped surviving a reload

The legacy chat persisted every turn to `stories/{id}/chats/{id}/messages`, but
the first assistant cutover kept its transcript only in `useLocalRuntime` and
lost it on refresh. That regression is not acceptable. P7-T1 and P7-T2 are back
in scope: story-data persists story-scoped threads and rich message parts, and
the assistant-ui history adapter restores them when the panel reopens.

### 4. In production today the legacy chat is the only chat

`ASSISTANT_UI_ENABLED` is `import.meta.env.DEV && VITE_ASSISTANT_UI_ENABLED`,
and `ASSISTANT_LEGACY_FALLBACK_ENABLED` defaults to true. A production build
therefore renders the legacy `Chatbot` and cannot render the assistant at all.
Deleting the legacy path without first allowing the assistant in a production
build leaves the product with no chat.

**Decision: the flag promotion is the first task, and deletion is the last.**

## Tasks

### 7-T1: Close the quota gap (frontend/functions)

- Call `checkAiAccess(userId)` inside `handleAssistantRun`, before the relay
  opens, and refuse with the same 429 shape the legacy endpoint used.
- The browser already renders `assistant-error-quota_exceeded` for a refusal
  without leaking the upstream body; assert the 429 maps to it.
- Continuations (an approved edit resuming a run) should not be charged a second
  time against the daily counter — the model work was already counted on the
  first leg.

### 7-T2: Carry BYOK onto the assistant path (frontend/functions, agents)

- Resolve `aiSettings` for the caller and attach `provider_config` to the run
  request, reusing the decryption path `agent/client.ts` already uses.
- Confirm the agent forwards it to creditProxy for **every** model step in a
  run, not just the first, and that a BYOK run reserves no platform credits.
- Add a test that a BYOK run leaves the user's credit balance untouched.

### 7-T3: Promote the assistant out of dev-only (frontend)

- Drop the `import.meta.env.DEV` conjunct from `ASSISTANT_UI_ENABLED`; the
  server flags remain authoritative.
- Default `VITE_ASSISTANT_UI_ENABLED` to true and
  `ASSISTANT_LEGACY_FALLBACK_ENABLED` to false in `.env.example` and in the
  deployed configuration.
- Ship and exercise this state before any deletion, so a rollback is a flag
  flip rather than a revert.

### 7-T4: Delete the frontend legacy chat (frontend)

Remove, in this order: `Chatbot.tsx` (207 lines), `ChatMessage.tsx`,
`EmptyChatState.tsx`, `src/stores/chatStore.ts` (143) and its export from
`stores/index.ts`, `src/cloudFunctions/chat.ts`, and the legacy branch of
`FloatingChatButton.tsx` — which then collapses to a trigger for one panel.
`SimpleEditor.tsx` and `Story.tsx` keep mounting it unchanged.

### 7-T5: Delete the server endpoints, rules and index (frontend/functions)

- Delete `sendChatMessage.ts` (160 lines), `clearChatSession.ts` (48), and both
  exports from `functions/src/index.ts`.
- Delete the `stories/{storyId}/chats/{chatId}` and nested `messages` blocks
  from `firestore.rules`, and the `chats` collection-group entry from
  `firestore.indexes.json`.
- **Leave `bookClubs/{clubId}/messages` alone.** It is a different realtime
  chat with its own rules and is not part of this work.
- Drop the `legacy` member of `assistantFlags()` once nothing reads it.

### 7-T6: Delete the agent-side legacy tool (agents)

- Remove the `chatWithContext` action from `server.py` and `action_schemas.py`,
  `ChatWithContextTool` and its re-export from `tools.py`, and its registration
  in `agent.py`.
- Delete `tests/test_chat_logging.py` and the `chatWithContext` cases in
  `tests/test_server.py` and `tests/test_action_schemas.py`.
- Confirm nothing else imports the slim-roster/excerpt helpers it used; keep
  them if the assistant read tools share them.

### 7-T7: Tests (frontend/agents)

- Delete `cypress/e2e/ai_chat.cy.ts`, which tests only the legacy path and is
  currently failing.
- Update `tests/rules/firestore.rules.test.ts`: the `stories/*/chats` cases
  become assertions that clients can no longer write there at all.
- Verify `assistant_panel.cy.ts` covers what `ai_chat.cy.ts` covered that still
  matters — send, render, quota refusal, provider failure — and add any missing
  case there rather than keeping the old spec alive.

### 7-T8: Naming and documentation (all repositories)

- Rename `ASSISTANT_STREAM_SPIKE_ENABLED`; it stopped being a spike three
  phases ago. `ASSISTANT_GATEWAY_ENABLED` matches what it starts. Update
  `dev-new.sh` and `scripts/e2e-stack.sh` together — note `dev-new.sh` lives in
  the workspace root and is not under version control in any repo.
- Fix copy that is no longer true: `.env.example`'s "Assistant Phase 0
  development preview", and `featureFlags.ts`'s "read-only assistant is
  development-only" — it has not been read-only since Phase 5.
- Set the status lines of the Phase 3, 4 and 5 plan documents to reflect that
  they are implemented, not "proposed".
- Update the three `CLAUDE.md` files: the workspace root still lists AI chat
  sessions under "intentionally Firestore, not migrating"; the frontend's still
  documents `stories/{id}/chats/{id}/messages`, `/sendChatMessage` and a
  `chat/` directory containing "Chatbot and floating chat button"; the agents'
  still lists `ChatWithContextTool`.
- Update the wiki: `AI-API-Reference.md` documents `POST /sendChatMessage` and
  the `chatWithContext` action with its 5,000-character cap, and
  `Architecture-Overview.md` has it in a sequence diagram. Replace both with
  the assistant run flow.
- Replace remaining user-facing "NovelSync" copy in assistant surfaces with
  TheTaleTribe (`AiSettings.tsx`, `OwnerSettings.tsx`). The `@novelsync/*`
  package names are internal and stay — 73 files import them and renaming is
  not this phase's job.
- Document how to select mock, Ollama, platform and BYOK modes in one place,
  including `OLLAMA_MODEL` needing a tool-capable model: `phi4-mini` advertises
  tools and does not emit them, which presents as an assistant that narrates a
  tool call in prose and then stops.

### 7-T9: Drop the orphaned transcripts (frontend)

Deleting the rules does not delete the data. `stories/*/chats/*/messages`
documents remain in Firestore, now unreachable by any client. Do not purge them
until P7-T1 and P7-T2 are live and the owner has explicitly chosen whether to
migrate or discard the legacy transcript.

## Ordering

The durable P7-T1 backend lands before the P7-T2 frontend adapter, and both land
before the legacy transcript purge. Canonical MCP writes and parity follow;
only after every MCP story mutation uses story-data may writes default on. The
existing 7-T1 and 7-T2 capability-gap tasks can run in parallel. 7-T3 ships the
assistant as the default with the legacy path still present and revertible by
flag. Only then do 7-T4 through 7-T6 delete, in that order — browser, then
Function, then agent — so that at no point does a live caller outlive its
handler. 7-T7 follows the deletions. 7-T8 can land after 7-T6; 7-T9 waits for
durable storage and an explicit migration-or-purge decision.

## Phase gate

- The assistant renders in a production build with no legacy fallback present.
- A user at their daily `MAX_AI_USAGE` ceiling is refused on the assistant path,
  with no upstream body leaked to the browser.
- A BYOK user completes an assistant run, including a tool round, with no
  platform credits spent.
- Assistant messages, structured parts, sources, and approvals survive a panel
  close and page reload without crossing story or owner boundaries.
- MCP story mutations use story-data revisions and are enabled by default only
  after the Firestore write path is gone.
- No `Chatbot`, `chatStore`, `sendChatMessage`, `clearChatSession` or
  `chatWithContext` symbol remains in any repository.
- `firestore.rules` denies client access to `stories/{id}/chats`, book-club
  messages still work, and the rules tests assert both.
- `yarn lint`, `yarn test`, `npm test --prefix functions`, the agents suite and
  the assistant Cypress spec all pass.
- Every document listed in 7-T8 describes the assistant, not the legacy chat.

## Verification

```bash
# unit and contract
cd repos/taleTribe-agents && venv/bin/python -m pytest tests/ -q
cd repos/taleTribe-frontend && npx vitest run && npm test --prefix functions
cd repos/taleTribe-frontend && yarn assistant:contracts:check

# rules
cd repos/taleTribe-frontend && npm run test:rules

# browser
cd repos/taleTribe-frontend && ASSISTANT_UI_E2E=true ASSISTANT_EDIT_E2E=true \
  CYPRESS_SPEC=cypress/e2e/assistant_panel.cy.ts ./scripts/e2e-stack.sh

# the deletion is complete when this is silent
grep -rn "Chatbot\|chatStore\|sendChatMessage\|clearChatSession\|chatWithContext" \
  repos/taleTribe-frontend/src repos/taleTribe-frontend/functions/src \
  repos/taleTribe-agents/agents repos/taleTribe-agents/server.py
```
