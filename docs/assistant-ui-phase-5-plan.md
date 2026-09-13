# Assistant Phase 5 implementation plan: active editor context and approved edits

Date: 2026-09-13. Status: proposed. Scope: P5-T0 through P5-T6 of
[the integration plan](assistant-ui-integration.md#phase-5--active-editor-context-and-approved-edits).
Predecessor: [Phase 4](assistant-ui-phase-4-plan.md), implemented on
`feature/assistant-phase-4-read-only-ui` with its run-aware mock on
`creditProxy/feature/assistant-phase-4-run-aware-mock`.

Phase 5 adds one deliberately narrow write path: the assistant may propose a
replacement for the writer's current non-empty text selection, the writer may
review it, and only an explicit Apply action may change the active TipTap
document. The resulting document still saves through the existing
`storyWorkspaceRepo.updateChapter` and `If-Match` path. Neither agents nor a
Cloud Function writes chapter content.

The governing rule is that the model proposes text, but the active editor owns
truth and execution. A proposal is inert data. Immediately before Apply, the
frontend re-checks the active story, chapter, document version, persisted
revision, range, and original text. Any mismatch makes the proposal stale; it
is never silently rebased.

## What is already implemented

The repositories already contain more of Phase 5's vocabulary than the
original roadmap assumes:

- The frontend runs `@assistant-ui/react` `0.15.18` through
  `useLocalRuntime` and a custom `ChatModelAdapter`. It renders server-executed
  read tools but deliberately treats `approval.requested` as unsupported.
- The v1 request already has `editorContext` fields for `chapterId`,
  `persistedRevision`, `documentVersion`, `selection`, and `dirty`. The browser
  transport does not populate them yet.
- The v1 schema already defines `propose_editor_edit`, `apply_editor_edit`,
  `approval.requested`, and `approval.resolved`. The generated
  `approval-pause-resume` fixture is illustrative, not a viable network
  exchange.
- Agents already carries the request's editor context into `ToolRuntime`, and
  `read_current_editor` returns a supplied selection. Edit schemas are not
  offered to the model and have no executors.
- `SimpleEditor` owns the active TipTap instance, chapter state, and
  `useAutosave`. Every TipTap update already flows through one content-change
  callback and the normal three-second autosave pipeline.
- `StoryWorkspaceRepo` sends chapter writes to story-data with `If-Match` and
  updates its private revision cache from every successful response.
- The assistant panel is mounted at the story-workspace level, above the
  editor route. It therefore needs a story-scoped bridge rather than a direct
  TipTap prop.
- Functions and agents both have an
  `ASSISTANT_EDIT_PROPOSALS_ENABLED` setting, but the live run loop still
  hard-codes edit tools off and the Functions edit flag does not yet guard a
  continuation.

## Preflight gaps

### 1. The editor context cannot represent a dirty buffer window

`EditorContext` was intentionally designed not to carry a manuscript. That is
correct for a whole chapter, but the current shape only carries the selection.
When there is no selection, or useful surrounding prose is dirty, agents cannot
honestly satisfy `read_current_editor(selectionOnly=false)`; its current result
always says `full_document_available: false`.

Add one optional, bounded plain-text window to `EditorContext`:

```ts
type EditorTextWindow = {
  text: string;
  truncated: boolean;
};
```

The initial limit should be 8,000 characters, shared by the Python schema and
generated frontend constants. It is not HTML, TipTap JSON, or the complete
chapter by default. Prefer a window containing the selection or cursor and
fall back to the beginning of the document only when no meaningful anchor is
available. The exact extraction algorithm must be deterministic and tested.

This is an additive optional v1 field. Export the agents schema first, then
regenerate the frontend package and fixture hashes. Deploy agents before a
frontend that sends the field because request writers remain strict.

### 2. Approval must cross two HTTP requests

The current fixture emits `approval.requested`, `approval.resolved`, and the
edit result in one uninterrupted SSE response. A user cannot make a decision
inside that response, and holding it open is incompatible with the stateless
gateway, its request deadline, cancellation, and eventual horizontal scaling.

Use two bounded `/assistant/run` requests:

1. The proposal request ends with a resultless `apply_editor_edit` tool part,
   `approval.requested`, then `run.completed(finishReason="tool_calls")`.
2. After the user acts, a continuation request carries the decision and the
   typed client result. Its stream starts a new run, emits
   `approval.resolved`, produces bounded completion text, and ends normally.

Add an optional strict continuation object to `RunRequest` rather than a new
endpoint:

```ts
type EditorContinuation = {
  kind: "editor_approval";
  previousRunId: string;
  approvalId: string;
  toolCallId: string;
  proposalId: string;
  decision: "applied" | "rejected" | "revision_requested" | "apply_failed";
  proposal: ProposeEditorEditArgs;
  result?: EditorApplyResult;
  feedback?: string;
};
```

Every string and nested operation remains bounded. The gateway overwrites
`storyId` and `userId` exactly as it does for an initial run; agents re-checks
ownership and validates the proposal again. No signed resume token or durable
run store is needed in this phase because the continuation cannot perform a
server-side write: a forged continuation can only affect assistant text for a
story the authenticated user already owns. Durable resumability belongs to
Phase 7.

Make `proposalId` a deterministic digest of the canonical validated proposal
and the initial `runId`. Agents recomputes it on continuation before accepting
the linkage among the proposal, apply tool, approval, and prior run. This is
integrity checking, not authorization or a substitute for the repeated story
ownership check.

Replace the single impossible fixture with a paired proposal/pause fixture and
one fixture per resolution class. The mock must choose the continuation script
from the structured request, never from mutable process-global run state.

### 3. The pinned runtime supports provider approvals without a toolkit compiler

Keep the existing custom runtime. In `@assistant-ui/react` `0.15.18`, a
resultless tool-call part with `approval: { id, prompt }` and message status
`requires-action` pauses `LocalRuntime`; `respondToApproval` records the
decision and starts the next adapter round.

Do not introduce `humanTool()`: it requires the `"use generative"` compiler,
while Phase 0 deliberately proved this Vite application without
`@assistant-ui/vite`. Do not register a generic browser tool executor either.
The only mutation remains the explicit Apply handler in the typed editor-edit
card.

The adapter must read the current assistant message from
`unstable_getMessage()` on a resumed round. `messages` contains the history up
to the parent user message and is not sufficient to find the resolved
approval.

## Scope adjustment

- **One selected-text replacement.** Require one non-empty text selection and
  exactly one `replace` operation matching it. Empty replacement text is an
  explicit deletion. Defer insert-at-cursor, multiple operations, whole-chapter
  edits, and inactive-chapter edits.
- **One text block.** For the first writable slice, reject selections spanning
  block boundaries or containing atom nodes such as images. Reject replacement
  text containing paragraph breaks. This keeps one `tr.insertText` transaction
  semantically exact; multi-paragraph parsing can be added after the stale and
  undo paths are proven.
- **No model markup.** Proposals carry plain text only. Never accept HTML,
  Markdown-as-HTML, or model-supplied TipTap JSON, and never use
  `dangerouslySetInnerHTML` to render a diff.
- **No server manuscript write.** `apply_editor_edit` is a browser action for
  the active buffer, not an agents or Functions executor. Phase 7 owns
  story-data-backed edits to inactive chapters and worldbuilding.
- **No durable pending approvals.** Closing and reopening the panel in the same
  mounted story workspace preserves the proposal. Reloading loses it. Story
  change or sign-out clears it synchronously.
- **No automatic approval.** Panel close, route change, timeout, Stop, retry,
  keyboard shortcuts, or a second model message must never be interpreted as
  Apply.
- **No automatic rebase.** A stale proposal remains readable and copyable, but
  Apply is disabled. The writer requests a fresh proposal.
- **No migration of legacy AI controls.** The Bubble Menu enhancement,
  Co-Write, image generation, and old chat fallback keep their current paths.
- **No edit claims while disabled.** A client presentation flag may reveal edit
  copy and renderers, but only both server-side edit flags may expose a
  proposal. The client flag is never authorization.

## Design decisions

### 1. Use a story-scoped EditorBridge with snapshot and command halves

Add an `EditorBridgeProvider` around the story workspace in `Story.tsx`.
`SimpleEditor` registers the active editor session while mounted; the
workspace-level `AssistantPanel` consumes it. Do not put the TipTap `Editor`
instance in chat context or pass it through `FloatingChatButton`.

The bridge should expose a small stable interface:

```ts
type EditorSnapshot = {
  storyId: string;
  chapterId: string;
  persistedRevision: number;
  documentVersion: number;
  dirty: boolean;
  selection: { from: number; to: number; text: string } | null;
  buffer: { text: string; truncated: boolean };
};

type EditorBridge = {
  getSnapshot(): EditorSnapshot | null;
  subscribe(listener: () => void): () => void;
  prepareSnapshot(): Promise<EditorSnapshot | null>;
  inspectProposal(proposal: EditProposal): ProposalCheck;
  applyProposal(proposal: EditProposal): Promise<EditorApplyResult>;
};
```

Keep the mutable editor and autosave functions private inside the registered
session. `getSnapshot` is synchronous and side-effect free.
`prepareSnapshot` flushes a pending save and waits for the save queue to settle
before returning when online; if that cannot succeed, it returns an explicitly
dirty snapshot that agents may read but may not turn into an applicable
proposal.

Use a small external-store shape rather than pushing every selection movement
through `Story.tsx` React state. `useSyncExternalStore` gives the panel and edit
card reactive snapshots while TipTap keeps its normal ownership.

Increment `documentVersion` once for every transaction with `docChanged=true`,
including typing, paste, undo/redo, Co-Write, and an approved assistant edit.
Selection-only transactions do not increment it. Registering another chapter
creates a new session with version zero; unregister the old session before the
new chapter can be observed.

Selection text must use one shared serializer on capture and revalidation,
including the same block separator. A selected image or other non-text leaf
makes the selection ineligible for an edit even if `textBetween` happens to
return plausible text.

### 2. Saving must expose a waitable settlement and the current revision

`useAutosave.forceSave()` currently returns immediately when another save is in
flight and merely queues the latest content. That is correct for existing UI
callers but is not strong enough for an edit snapshot or an Apply result.

Add a separate waitable operation such as `flushAndWait()`; do not silently
change the established `forceSave` contract. It resolves only after the latest
queued content is saved, or rejects with the typed story-data error. It returns
the saved revision and updates the bridge's internal revision before resolving,
then feeds the saved `Chapter` through normal editor state. Do not make
`prepareSnapshot` depend on a later React render to see the revision it just
awaited.

The revision has two jobs:

- before a proposal request, settling pending local work gives the model a
  stable `persistedRevision`; and
- after Apply, the normal story-data write still uses the repository's latest
  `If-Match`, so an external update produces a typed 409 instead of an
  overwrite.

An apply transaction and its save are distinct outcomes. If the transaction
succeeds but autosave fails, return `applied_local_save_failed` or
`applied_local_save_conflict`; keep the local content and Undo history intact,
show the save failure, and never claim the edit was saved.

### 3. Current-editor context is a send-time snapshot, not a live client tool

At the start of each request, the transport asks the bridge for one snapshot
and passes it to `buildRunRequest`. Agents' existing `read_current_editor` tool
reads only that immutable request snapshot. It does not call back into the
browser midway through a run.

This preserves the current one-way SSE transport and gives “current” an exact
meaning: current when Send was accepted. If the document changes while the
model is working, `documentVersion` makes the eventual proposal stale.

Agents must verify that the supplied chapter belongs to the already-authorized
story before returning the snapshot to the model. Return only bounded plain
text, IDs, revision/version numbers, dirty state, and truncation metadata.
Strip marks, node attributes, image URLs, comments, plugin state, DOM, and all
other TipTap metadata.

If no editor is registered, keep the Phase 4 result (`available: false`). If a
snapshot is dirty because save settlement failed, reads remain allowed but
proposal validation returns a safe non-applicable result.

### 4. Agents validates proposals and synthesizes the approval gate

Pass `settings.assistant_edit_proposals_enabled` into the run loop; remove the
hard-coded `edits_enabled=False`. Separate model-facing proposal schemas from
internal continuation actions:

- `propose_editor_edit` is offered only when the server edit flag is on and a
  valid active selection is present;
- `apply_editor_edit` is never a provider-executable or agents-executable
  mutation. Agents synthesizes its pending tool part after accepting one valid
  proposal; and
- a run may create at most one edit proposal. Once created, end the first
  request at the approval boundary rather than letting the model keep talking.

The proposal executor enforces the Phase 5 subset in addition to Pydantic:

- exactly one operation of type `replace`;
- `chapterId`, `baseRevision`, and `baseDocumentVersion` equal the request
  snapshot;
- `from`, `to`, and `originalText` exactly match the captured non-empty
  selection;
- the range is ordered and the replacement stays within the configured size;
- the selection is a supported single-text-block range; and
- dirty or missing editor context cannot produce an applicable proposal.

The first request's relevant event sequence is:

```text
tool.started(propose_editor_edit)
tool.args.delta(...)
tool.completed(proposalId)
tool.started(apply_editor_edit)
tool.args.delta({ proposalId })
approval.requested(toolCallId=apply call)
run.completed(finishReason=tool_calls)
```

This fixes the existing fixture's ordering bug: an approval cannot refer to an
apply tool part that the browser has not received yet.

On continuation, agents validates the copied proposal, recomputes its ID, and
checks the current authorized story again. The continuation also carries a
fresh editor snapshot; the initial snapshot remains the proposal's stale-check
base. Applied/rejected outcomes get deterministic completion text and do not
spend another model call. `revision_requested` may make one bounded model call
using the original request text, prior proposal, fresh editor snapshot, and
bounded user feedback to produce a new proposal. It cannot inherit arbitrary
browser thread history.

### 5. Project approvals into assistant-ui and keep local action results typed

Extend `RunState` to retain approval requests keyed by `approvalId` and linked
to `toolCallId`. A pending request attaches this provider approval to the
resultless `apply_editor_edit` part:

```ts
approval: {
  id: approvalId,
  prompt: summary,
  display: "decision",
}
```

When the stream ends with `finishReason="tool_calls"` and an unresolved
approval exists, return `{ type: "requires-action", reason: "tool-calls" }`,
not Phase 4's generic incomplete state. A `tool_calls` finish without a valid
approval remains an error/unsupported state.

Maintain a story-scoped, in-memory action ledger keyed by `approvalId`. It
stores `idle`, `applying`, or the typed application result. The Apply handler
writes the result before calling `respondToApproval({ approved: true })`, so
the adapter's resumed round can build the continuation from
`unstable_getMessage()` plus the ledger. Reject records no mutation and calls
`respondToApproval({ approved: false, reason: "rejected" })`.

“Ask for revision” collects bounded plain-text feedback, resolves the current
approval as rejected with reason `revision_requested`, and sends that feedback
through the structured continuation. It is not implemented as an ordinary
follow-up message because Phase 4 intentionally sends no transcript history.

Raise the LocalRuntime round-trip ceiling enough for proposal → decision → one
revision cycle, while retaining the agents model/tool ceilings for every
request. A runtime ceiling is not an authorization boundary.

### 6. The edit card is a review surface, not a generic tool renderer

Add a dedicated `apply_editor_edit` renderer; unknown tools remain read-only.
Resolve its proposal by exact `proposalId` from the preceding validated
`propose_editor_edit` part. Never associate it with “the most recent” proposal
without matching the ID.

The card shows:

- the proposal summary and active chapter title;
- a clear Before and After view using text nodes only;
- deletion wording when replacement text is empty;
- one-operation scope and bounded character counts;
- stale/ineligible reasons as visible status, not tooltip-only information;
- Apply, Reject, Copy replacement, and Ask for revision controls; and
- Applying, saved, locally applied but unsaved, rejected, and stale terminal
  states.

Disable Apply while the proposal is stale, the active editor is absent, a save
is settling, the app is offline, another action is in flight, or the approval
has already resolved. Clicking twice must never dispatch two transactions.

The dialog may close with a pending proposal. Reopening restores the card in
the same story workspace; it does not approve or reject. Switching chapter
makes it stale immediately. Switching story or signing out resets the runtime,
bridge, and action ledger.

### 7. Apply one plain-text transaction, then use the normal save path

`EditorBridge.applyProposal` performs all checks again at click time. For the
MVP operation:

```text
verify active story/chapter
verify documentVersion and persistedRevision
verify range bounds and supported selection shape
serialize current range and compare originalText exactly
verify replacement size and chapter limits
dispatch one tr.insertText(replacementText, from, to)
mark origin = assistant-approved-edit; keep addToHistory = true
flush the normal autosave and report its outcome
```

Do not call `setContent`; it would replace the whole document and damage the
selection/undo semantics. Do not update React chapter state separately; the
existing TipTap `onUpdate` path remains the single content and autosave path.

Confirm that the transaction was accepted by the existing character and word
limit plugins. A filtered transaction is an apply failure, not success. Focus
the editor and select the inserted range after success only when doing so does
not steal focus before the approval card has announced its result.

Undo is intentionally ordinary TipTap Undo. Undoing after a saved assistant
edit is another local edit and flows through autosave as usual.

## Tasks

### P5-T0: correct the contract, fixtures, and deterministic mock

Repositories: `taleTribe-agents`, `taleTribe-frontend`, and `creditProxy`.

- Add the bounded editor window and strict editor continuation request.
- Regenerate the schema, TypeScript contract, and fixture manifests.
- Replace the impossible single-stream approval fixture with proposal/pause and
  resolution fixtures whose run IDs and sequences are independently valid.
- Extend `RunState` for approvals and prove that an approval references an
  already-started tool.
- Extend the scripted mock with an initial proposal response and structured
  applied, rejected, stale/apply-failed, and revision-requested continuations.
- Add request-shape tests proving the browser cannot send `userId`, credentials,
  arbitrary history, unbounded content, or an untyped result.

Land this before UI work so the renderer is not forced to invent a private
pause protocol.

### P5-T1: create EditorBridge and waitable autosave settlement

Repository: `taleTribe-frontend`.

- Add the story-scoped provider/store and register/unregister it from
  `SimpleEditor`/`TipTapEditor`.
- Capture story/chapter, revision, dirty state, document version, selection,
  and a bounded plain-text window.
- Increment version for every document-changing TipTap transaction.
- Add `flushAndWait` without changing existing `forceSave` behavior.
- Update the bridge's persisted revision after each successful chapter save.
- Clear the registered session synchronously on chapter/story change and
  unmount.
- Unit-test transaction counting, selection serialization, buffer bounds,
  save settlement, and teardown ordering.

### P5-T2: send and authorize current-editor reads

Repositories: `taleTribe-frontend` and `taleTribe-agents`.

- Snapshot editor context when the adapter accepts Send; do not reuse a prior
  request's snapshot on retry.
- Send no context outside the editor route or when the registered session does
  not match the panel's story.
- Verify the context chapter belongs to the authorized story in agents.
- Return selection-only or bounded-window results according to the validated
  tool arguments, including dirty/truncated metadata.
- Update the system prompt so “current editor” means the request snapshot and
  dirty context is never presented as canonical saved text.
- Show concise UI metadata that a selection/editor window was shared.

### P5-T3: validate proposals and implement stateless continuation

Repositories: `taleTribe-agents` and frontend Functions.

- Thread the server edit setting into tool selection and keep it default-off.
- Implement the selected-text-only proposal validator and proposal ID.
- Synthesize the resultless apply tool plus approval request after one valid
  proposal; do not execute a write in agents.
- End the first SSE request at `finishReason="tool_calls"`.
- Accept structured continuations on the existing endpoint, pin identity/story
  in Functions, and reject continuations when the Functions edit flag is off.
- Revalidate ownership, bounds, proposal linkage, and result shape in agents.
- Return deterministic applied/rejected/failure acknowledgements; use at most
  one model call for revision feedback.
- Log IDs, outcome, and safe codes only. Never log selected, before, after, or
  buffer text.

### P5-T4: render diff and approval controls

Repository: `taleTribe-frontend`.

- Map the protocol approval onto the exact apply tool part and pause
  LocalRuntime with `requires-action`.
- Add the typed edit renderer and exact proposal lookup.
- Render bounded Before/After text, deletion state, counts, chapter, and stale
  reason without HTML interpretation.
- Implement Apply, Reject, Copy, and Ask for revision with accessible labels,
  keyboard focus, progress states, and single-dispatch protection.
- Update assistant copy/suggestions behind a presentation flag without making
  that flag authorize tools.
- Preserve pending review on panel close; invalidate it on chapter change and
  clear it on story/auth change.

### P5-T5: apply, undo, and save one safe transaction

Repository: `taleTribe-frontend`.

- Implement the pure proposal inspection result and the imperative apply
  command behind EditorBridge.
- Revalidate every freshness and content invariant at click time.
- Apply one supported replacement/deletion with `tr.insertText` in one
  history-enabled transaction.
- Confirm the transaction changed the expected range and was not filtered by a
  document limit.
- Flush through the existing autosave/repository path and surface saved,
  offline, generic save failure, and `StoryDataConflictError` outcomes.
- Preserve local content and Undo on every save failure; never reload or
  overwrite automatically after a 409.
- Feed the typed outcome into the continuation adapter exactly once.

### P5-T6: editor-edit tests and phase gate

Repositories: `taleTribe-frontend`, `taleTribe-agents`, and `creditProxy` for
the deterministic mock.

Frontend unit/fixture coverage:

- bridge registration, synchronous clearing, document versioning, selection
  and bounded-window serialization;
- initial and continuation request shapes, fresh client message IDs, and
  absence of identity, secrets, HTML, TipTap JSON, and arbitrary history;
- approval projection, `requires-action`, resolution, panel close/reopen, and
  double-click protection;
- exact selected-text replacement, deletion, Undo, autosave, and updated
  revision;
- stale document version, stale revision, chapter/story switch, changed
  original text, invalid/reversed/out-of-range positions, cross-block and atom
  selections, paragraph breaks, oversized output, and filtered transactions;
- rejected proposal, revision feedback, offline save, provider failure, and
  story-data 409 with local content retained; and
- literal HTML-looking replacement text rendering/insertion, proving it cannot
  execute as markup.

Agents coverage:

- edit flag off/on tool exposure and Functions defense-in-depth gating;
- proposal subset validation and one-proposal-per-run ceiling;
- editor chapter membership and story ownership checks;
- pause ordering and terminal `tool_calls` state;
- applied/rejected/revision/apply-failed continuation validation;
- malformed, oversized, overlapping/multiple, insert, wrong-chapter, wrong
  revision/version, and identity-bearing arguments; and
- property/parameterized fuzz coverage for operation validation without adding
  a fuzz dependency unless the repository already supports one.

Integrated Cypress coverage through the local first-party gateway:

- select a sentence, request a rewrite, review Before/After, Apply, observe the
  editor change, observe Saved, Undo, and observe the undo save;
- Reject and prove the TipTap document and story-data chapter are unchanged;
- close/reopen with a pending proposal and prove no edit occurred;
- type after proposal creation and prove Apply becomes stale;
- switch chapters with a pending proposal and prove it cannot target the new
  editor;
- approve during an autosave and prove settlement/revision ordering;
- force a story-data 409 and prove local edited content remains visible with an
  honest conflict state;
- request revision feedback and receive a new proposal without carrying
  unrelated transcript history;
- sign out or switch stories with a pending proposal and prove all bridge,
  approval, and action state is gone; and
- one mobile keyboard/focus pass covering the diff and all approval controls.

## Ordering

```text
P5-T0 contract + two-request mock
          |
          +------> P5-T1 EditorBridge + autosave settlement
          |                         |
          +------> P5-T3 agents proposal/continuation
          |                         |
          +------> P5-T2 editor reads
                                    |
                    P5-T4 review UI + approval adapter
                                    |
                    P5-T5 transaction + save outcomes
                                    |
                              P5-T6 gate
```

P5-T1 and the agents half of P5-T3 can proceed in parallel after the contract
lands. P5-T4 can render static paired fixtures while P5-T3 is completed. P5-T5
must use the real bridge and autosave result rather than a card-local TipTap
reference. The end-to-end gate comes last because it proves the trust boundary
across all three repositories.

Natural review boundaries are: contract/fixtures, bridge/autosave, agents and
gateway approval flow, then UI/application/integration tests. Keep edit flags
off until the entire stack is deployed in dependency order.

## Phase gate

- With edit flags off, Phase 4 remains read-only and an unexpected approval or
  edit tool still fails closed.
- With edit flags on, a writer can select text, request one replacement, inspect
  a bounded Before/After view, Apply or Reject it, and ask for one revision.
- No TipTap change occurs without the Apply click. Close, Stop, retry, route
  changes, sign-out, and model output cannot approve an edit.
- Apply revalidates story, chapter, revision, document version, range, selection
  shape, and original text. Any mismatch is stale and causes zero transactions.
- A successful Apply is one undoable TipTap transaction and uses the existing
  story-data autosave with `If-Match`; no Firestore or server-side manuscript
  write is added.
- A save failure or 409 never discards local content or claims success. The UI
  distinguishes locally applied, saved, conflicted, rejected, and stale.
- Browser-to-agent data is bounded plain text. Model HTML, TipTap JSON,
  identity fields, unbounded history, and unsupported operations are rejected.
- Proposal and continuation requests remain bounded by the existing model,
  tool, time, and credit ceilings; revision feedback adds at most one model
  call.
- `yarn test`, `yarn build`, Functions tests, agents tests, schema/fixture drift
  checks, and the Phase 5 Cypress flow pass. Changed files have zero lint
  errors; any unrelated repository-wide lint baseline is reported rather than
  folded into this phase.
