# NovelSync E2E (Cypress)

End-to-end tests for the core journey from `../flow.md`: **start a story → define
world-building → chat with the AI → iteratively generate chapters**. They drive
the real app against the full local stack (Firebase emulators + Python agent +
creditProxy with a mock LLM), so they exercise every repo, not just the UI.

## Run it

Everything in one shot (brings the stack up, runs all specs headless, tears down):

```bash
yarn e2e                 # = ./scripts/e2e-stack.sh
```

Author/debug interactively (stack stays up, opens the Cypress UI):

```bash
./scripts/e2e-stack.sh --open
```

Run a single spec:

```bash
CYPRESS_SPEC=cypress/e2e/ai_chat.cy.ts yarn e2e
```

### Manual two-terminal flow (best for iterating on specs)

```bash
# Terminal 1 — full stack incl. Vite (reuses the repo's dev orchestration)
../story/dev.sh           # creditProxy:8090, emulators, agent:8000, Vite:5173

# Terminal 2
yarn cy:open
```

## Prerequisites

- Docker (for creditProxy), a Python venv in `../taleTribe-agents` (`venv/`), and
  the Firebase CLI (via `yarn start:emulator`).
- The stack runs creditProxy on **8090** to avoid colliding with the Firestore
  emulator on 8080, and the agent with `USE_MOCK=true` + `LLM_PROVIDER=mock` for
  deterministic, key-free output.

## How it works

- **Seeding & state assertions** go through the emulator REST APIs with
  `Authorization: Bearer owner` (bypasses `firestore.rules`), implemented as
  Cypress Node tasks in `support/tasks.ts` — the same technique as
  `../story/scripts/seed-dev-user.mjs`. This is required for rules-protected
  fields (`users.aiUsage`/`aiSettings`/`storyCount`, `jobs/*`).
- **Auth**: specs seed an invited user (invite marked `completed`) and sign in
  through the real `/sign-in` form (`cy.login`).
- **No fixed sleeps**: doc assertions poll (`cy.pollDoc`, `cy.pollDocs`).

## Emulator caveats (see flow.md §7)

- **Vector indexing is OFF** under the emulator (`VECTOR_INDEX_DISABLED`) and
  `find_nearest` doesn't exist → `chapter_chunks` is never populated and chat RAG
  context is empty. Specs assert on entity/chapter docs, `chapterIndex`, and the
  job lifecycle — **not** on vector recall.
- **Mock LLM returns non-JSON** (`"Mock response to: <prompt>"`). Chat asserts on
  the `"Mock response to:"` prefix; chapter generation asserts on doc **shape**,
  not prose.

## Known skipped scenarios

- **BYOK chat bypass** (`ai_chat.cy.ts`): needs a real provider key — BYOK
  instantiates the user's actual provider, which a seeded fake key can't satisfy
  against the mock stack.

For real vector recall / BYOK, point the stack at a real GCP project with built
vector indexes instead of the emulator.

## Troubleshooting / notes

- **creditProxy must be up on :8090.** If chat/chapter requests error, check
  `curl localhost:8090/health`. `e2e-stack.sh` starts it; if you bring the stack
  up yourself, run it with `CREDIT_PROXY_PORT=8090 LLM_PROVIDER=mock`.
- **IPv4 vs `localhost`.** The app calls the Functions emulator at
  `http://127.0.0.1:5001` (see `src/api/index.ts`), not `localhost`. On macOS
  `localhost` can resolve to IPv6 `::1`, where the emulator (IPv4-only) refuses
  the connection, so browser requests to Functions silently fail. The cypress
  `functionsBase` env uses `127.0.0.1` for the same reason.
- **Seeded users include `followers`/`following`.** The own-profile
  `firestore.rules` update branch requires `followers` to be unchanged, so the
  app's `lastLogin` merge on sign-in fails if the seeded user doc omits it.
- **Node ≥ 20** is required (the repo targets Node 22). Use `nvm use 22` before
  running, or rely on `e2e-stack.sh`.
