# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Artifacts

**Never publish an Artifact without explicit permission.** This overrides the
default behaviour of publishing finished work proactively — assume the answer is
no unless asked.

Deliver documents, reports, plans and reviews as files in the repo, and say where
they landed. If a shareable link would genuinely help, ask first and wait for a
yes before publishing.

## Commands

```bash
yarn dev              # Start Vite dev server
yarn build            # TypeScript check + Vite production build
yarn build:analyze    # Build with bundle analysis (opens stats.html)
yarn lint             # ESLint — fails on any warnings
yarn preview          # Preview production build locally
yarn start:emulator   # Start Firebase emulators (runs from functions/)
yarn kill-ports       # Delegates to ../../kill-ports at the workspace root,
                      # which frees the emulator/agent/Vite ports and stops the
                      # story-data + creditProxy containers
yarn test             # Vitest unit suite (tests/, excludes tests/rules/)
yarn test:watch       # Vitest in watch mode
yarn test:rules       # Firestore rules tests — needs a running emulator
```

`yarn lint` currently reports 89 pre-existing errors. Every file under
`functions/src/` fails to parse under the root ESLint config (it cannot resolve
`tsconfig.dev.json` from there), which accounts for most of them. Judge a change by whether it adds errors **in the files it
touches**, not by the total.

### Tests

Unit tests live in `tests/` and run under Node, not jsdom — they cover pure
logic only, never components. `tests/rules/` is excluded from `yarn test` and
run separately by `yarn test:rules`, which requires
`firebase emulators:start --only firestore`; a rules suite that silently passes
with no emulator is worse than no suite.

Modules reached by `tests/` must be listed in `tsconfig.test.json` — including
`packages/story-data-client/src`, which is listed as a whole directory. Everything
the suite touches now lives in this repo's `src/` or in `packages/`; nothing under
`functions/src/` is reachable from `tests/`.

There is no component-level coverage. E2E lives in `cypress/e2e/`
(`story_lifecycle`, `ai_chat`, `worldbuilding_indexing`, `chapter_comments`,
`public_discovery`) and is not part of `yarn test` — run it with `yarn e2e`, which
brings up the whole stack via `scripts/e2e-stack.sh`, or `yarn cy:open` /
`yarn cy:run` against an already-running stack. Nothing covers competitions yet;
that path is verified by seeding (see below).

## Path Aliases

`@/` maps to `./src/`. Two workspace packages resolve by name:
`@novelsync/story-data-client` and `@novelsync/platform-auth`. All three are
declared in `tsconfig.app.json`, `tsconfig.json`, `vite.config.ts` and
`vitest.config.ts` — adding a package means adding it in all four.

Always use `@/` for app imports — never deep relative paths like `../../../`.

## Comments

This codebase has a lot of comments and most of them earn their place. That is
not licence to add more: the existing ones survive because they explain a
constraint you could not recover by reading the code. Match that bar, not the
density.

**Default to no comment.** The code says what it does. Add a comment only when
a reader who understands the code would still ask "why like this?"

Worth writing:
- An external constraint the code obeys silently — "Firestore caps a
  transaction at 500 writes", "the ledger rejects a zero delta".
- A plausible alternative that is wrong — why an assertion measures the
  unapplied portion, why a value is stored rather than read from config.
- A cross-file invariant that nothing enforces mechanically — KEEP IN SYNC
  pairs, "escrow's balance is `prizePool + entryFeesHeld`".
- A safety property that looks incidental — why `list` must stay `false`.

Not worth writing:
- Restating the next line. `// Escrow is empty` above `entryFeesHeld: "0"`.
- Change archaeology. Comments about what a thing "used to be", what you just
  replaced, or why you made an edit. Git has this; the comment reads as noise a
  week later.
- Layout narration in JSX. If a class list needs explaining, name the thing.
- Docstrings that restate the signature. A `getX` returning `X` needs nothing.

**Keep it short.** One or two lines is normal. A multi-paragraph header is for a
module whose *design* is non-obvious — `competitionSettlement.ts` explaining why
settlement is not one transaction is the bar. Reaching that length to justify a
single function usually means the comment is padding, or the function is wrong.

Write the comment for someone changing the code, not someone reviewing your
work. If a sentence only makes sense to a reader who watched you write it, cut it.

## Architecture

### Stack
React 19 + TypeScript 5 + Vite 5. Firebase (Auth, Firestore, Functions, Storage) for backend. thirdweb/Wagmi for Ethereum wallet integration. TipTap for rich text editing. React Router v7 for routing.

### Entry Points
- `src/main.tsx` — Provider stack + all route definitions (code-split via `React.lazy`)
- `src/NavbarWrapper.tsx` — Layout shell wrapping all non-auth routes

### Provider Stack (outermost → innermost)

```
SEOProvider                  react-helmet-async
  QueryClientProvider        the single app query client
    Web3Provider             wagmi
      AuthBootstrap          renders null; see below
      RouterProvider
      ThemeToaster
```

There is no `AuthProvider`, `ThemeProvider` or `ChatProvider` — that state is
zustand (`src/stores/`), and `src/contexts/` holds selector hooks over those
stores rather than React contexts. **Nothing in `src/contexts/` calls
`createContext`.**

`AuthBootstrap` renders nothing and does two jobs: at module load it calls
`configureStoryData(...)` to give the story-data client its base URL and token
provider, and on mount it subscribes to `onAuthStateChanged` to hydrate
`authStore` and clear the query cache when the signed-in user changes. The
`configureStoryData` call is at module scope deliberately — a route loader can
fire a repo call before any component mounts, and an unconfigured client throws.

### Routing
All routes are defined in `src/main.tsx` using React Router v7. Every route is lazy-loaded. Key route groups:
- `/create/:storyId` — writing workspace (children: `/characters`, `/plot`, `/places`)
- `/story/:id` — public reader view
- `/user-stories` — author dashboard
- `/explore`, `/book-clubs`, `/library` — discovery

### Data Layer

**Cloud Functions client** (`src/cloudFunctions/`): `index.ts` is the transport — a custom HTTP client that auto-attaches the Firebase Auth bearer token, points at the local emulator (`localhost:5001`) in dev, and throws `ApiError`. `ai.ts`, `chat.ts` and `storage.ts` are typed wrappers, one function per endpoint. Import it as `@/cloudFunctions` (or `@/cloudFunctions/ai`) — never by a relative path.

**story-data client** (`packages/story-data-client`): stories, chapters,
worldbuilding, social, guestbooks, profiles, public reads and reading history are
served by the `story-data` PostgreSQL API, reached over the `/story-data` Vite
proxy with the caller's Firebase ID token.

The seven repos live in `packages/story-data-client/src/repos/` and share one
`request()` (`src/request.ts`). Their wire types live beside them in
`src/types/`. Three more story-data callers stayed in the app because they carry
app-only dependencies, but they use the same shared `request()`:
`CompetitionService.ts`, `TokenService.ts`, and `src/routes/BookClub/bookClubRepo.tsx`.

Two rules govern that package:

- **It must never import firebase.** `authStore` imports `profileRepo`, so a
  firebase import here would close a cycle; it also keeps the package loadable
  under vitest, which is why the transport has tests. Need the current uid inside
  a repo? `getStoryDataConfig().getUid()`, injected at bootstrap.
- **Branch on `error.status`, never on message text.** Use `isNotFound(error)`.
  A `{ error }` body from the server replaces the generated message, so
  `message.includes("(404)")` misses exactly the responses it was written for.
  That bug shipped more than once.

`StoryWorkspaceRepo` and `StoryWorldbuildingRepo` send `If-Match`; a 409 comes
back as `StoryDataConflictError`.

**Firebase access** (`packages/platform-auth`): owns `initializeApp` and the
emulator wiring, and exports `auth`, `firestore`, `storage`, `functions` plus
`getAuthContext()` (async token), `getCurrentUid()` (sync uid) and
`useAuthIdentity()` (`{ uid, email, isAdmin, loading, isSignedIn }`, read straight
off the SDK via `useSyncExternalStore`). Never call `initializeApp` anywhere else.

**`src/services/`** holds stateful client-side modules that own a connection or
a cache and are not components or hooks. It is not one backend — read the
imports to see which a given file talks to:
- `ChatService.ts`, `RateLimitService.ts` — **Firestore** (realtime chat; `userActivity` counters)
- `CompetitionService.ts`, `TokenService.ts` — **story-data**
- `StorageService.ts` — Firebase Storage, with a Cloud Function reserving quota first
- `DictionaryService.ts` — an **external** API (dictionaryapi.dev), with an in-memory cache
- `HighlightService.ts` — **localStorage**, no network

A thin typed wrapper over a single Cloud Function does *not* belong here — that
is `src/cloudFunctions/` (see the Data Layer above). `credits.ts` and `images.ts`
live there for that reason.

Do not add new Firestore access for a domain story-data owns.

**Custom Hooks** (`src/hooks/`): `useAutosave()` handles periodic draft saves to Firestore. `useEditorState()` manages TipTap state. Web3 hooks (`useEarnings`, `useTippingContract`, `useWalletState`, `useTokenBalance`) wrap Wagmi.

### Firebase
Config in `packages/platform-auth/src/firebase.ts` (it used to be
`src/config/firebase.ts`). Set `VITE_USE_EMULATORS=true` (default in dev) to
connect to local emulators:
- Auth: 9099, Firestore: 8080, Functions: 5001, Storage: 9199

Firestore subcollection pattern: `stories/{id}/chapters`, `stories/{id}/chats/{id}/messages`.

### AI Features
- **Chat**: Real-time Firestore subcollection + Cloud Function (`/sendChatMessage`) with story-context RAG
- **Brainstorm / Text Enhancement**: API calls to Cloud Functions
- **Daily quota**: UI display uses `VITE_MAX_AI_USAGE` (default 100) and user profile fields (`aiUsage`, `lastAiUsageDate`). Server-side enforcement is in `functions/src/aiSettings.ts` (`checkAiAccess` → `consumePlatformDailyQuota`), controlled by `MAX_AI_USAGE` env var. Keep `VITE_MAX_AI_USAGE` aligned with `MAX_AI_USAGE`. BYOK users bypass quota.
- **Indexing budget**: (re)embedding is metered separately from the chat quota, at `MAX_INDEX_USAGE` (default 300/day) per user. It lives entirely in `taleTribe-agents` now — the outbox consumer (`postgres_context.py`, `indexing_usage` table in story-data) charges it; no Function is involved. A unit is one embedding pass, not one autosave: nothing collapses the outbox on the write side, so the consumer drops events superseded by a higher revision of the same source in the batch. Applies to BYOK users too: indexing uses the platform embedder regardless. Deletes are never gated. Over budget, an event is deferred to the next UTC day rather than dropped, so the index goes stale but never loses the write.
- **Per-user story cap**: enforced by story-data. The pre-cutover `onStoryWrite` trigger no longer exists in `functions/src/`; a vestigial `users.storyCount` field may still sit on old documents but nothing reads or writes it. Soft cap; the indexing budget is the hard cost ceiling.

### Web3
Wagmi config in `src/blockchain/config.ts`. Target chain from `VITE_CHAIN_ID` (default 31337 for local Anvil). Tipping contract ABI in `src/blockchain/abi/TippingPlatform.abi.json`. Wallet state machine: `DISCONNECTED → CONNECTING → CONNECTED → READY` (or `WRONG_NETWORK / ERROR`).

### Competitions and TALE

**Competitions and the TALE ledger live in `story-data`, not in Cloud Functions.**
`internal/store/competitions.go` owns the phases, the double-entry ledger, escrow
and the faucet; `migrations/000010_competitions.sql` and its successors own the
schema. Read `repos/story-data/docs/service-guide.md` before changing any of it.

There is no `ledger.ts`, `escrow/`, `money.ts`, `competitionPhase.ts`,
`competitionLifecycle.ts` or `competitionAdvanceTask.ts` under `functions/src/`
any more, and no `ESCROW_PROVIDER`, `COMPETITION_FEE_BPS`, `INITIAL_TALE_GRANT`
or `FAUCET_TALE_GRANT` environment variable anywhere. Ignore any older note that
says otherwise.

What lives in this repo:

- `src/services/CompetitionService.ts` — the story-data client (`/v1/competitions`)
- `src/services/TokenService.ts` — TALE balance and faucet (`/v1/me/token-balance`,
  `/v1/me/token-faucet`)
- `src/lib/money.ts` — amount formatting and arithmetic
- `src/lib/competitionPhase.ts`, `competitionListing.ts`, `competitionDraft.ts`,
  `competitionLedger.ts`, `competitionPhaseCopy.ts` — client-side phase
  derivation and presentation
- `src/components/explore/` — the whole competitions UI
- `functions/scripts/seed-competitions.js` — seeds through the real story-data
  endpoints (`STORY_DATA_URL`, default `http://127.0.0.1:8084`)

**Money representation is the one rule that has not moved.** Every amount that
crosses a boundary is a base-10 integer string in minor units; every calculation
between is BigInt. Never a `number` — one whole TALE is 10^18 minor units, far
past `Number.MAX_SAFE_INTEGER`, so float arithmetic on a balance is silently
wrong. `src/lib/money.ts` is the frontend's copy; the authoritative arithmetic is
in story-data.

TALE is an internal, non-redeemable token backing competition prize pools,
deliberately shaped like an ERC20 (18 decimals, integer minor units, an asset id)
so a real token contract could replace the off-chain ledger without changing how
amounts are represented. The `contracts` repo holds only `TippingPlatform.sol`
today; there is no TALE token and no escrow contract yet.

### Guestbooks and profiles

**Guestbooks, profiles and the follow graph are all in `story-data`.** They are
not in Firestore, and `firestore.rules` has no opinion about them — there is no
`publicProfiles` block, no `guestbook` block and no `mayPostOnWall()` in that
file. Ignore any older note describing `users/{uid}.followers` arrays or a
Firestore `publicProfiles` collection as the authority.

- Wall policy is enforced by `canPostGuestbook` in
  `story-data/internal/store/guestbook.go`.
- The follow graph is the `user_follows` table, reached through
  `PUT|DELETE /v1/profiles/{id}/follow` and `GET /v1/me/follows`.
- Profiles, including `guestbookPolicy`, are `internal/store/profiles.go`.

`public_profiles` also owns `firstName`/`lastName`/`writingInterests`
(migration `000017_profile_names.sql`) — nothing profile-related is split
across Firestore any more. Firestore's `users/{uid}` doc keeps only private,
owner-only state (`email`, `aiSettings`, quota counters); it has no `username`
either, since `authStore.hydrateUser`'s bootstrap path falls back to Firebase
Auth's own `displayName` instead, kept in sync by `authStore.updateProfile`.

`src/lib/guestbookPolicy.ts` only decides whether a compose form renders. It is
**KEEP IN SYNC** with `canPostGuestbook` — the two matrices are asserted
independently by `tests/guestbookPolicy.test.ts` on this side. A mismatch means
the UI offers a box whose write the server will reject.

`guestbookPolicy` is one of `nobody | following | mutuals | followers | everyone`,
and a missing value reads as **`everyone`** — the setting is additive, so accounts
predating it keep the open wall they had.

## Design System (Inkwell)

Use CSS variable–backed Tailwind tokens for all styling — never hardcode colors.

**Color tokens:** `ns-bg`, `ns-surface`, `ns-surface-hover`, `ns-elevated`, `ns-ink`, `ns-ink-secondary`, `ns-ink-muted`, `ns-accent`, `ns-accent-hover`, `ns-accent-deep`, `ns-accent-subtle`, `ns-gold`, `ns-border`, `ns-border-strong`, `ns-destructive`

**Typography:**
- `font-heading` — Cormorant (serif, titles)
- `font-body` — Crimson Pro (serif, prose)
- `font-ui` — Hanken Grotesk (sans, UI labels)

**Other tokens:** `shadow-ns`, `shadow-ns-lg`, `rounded-ns`, `rounded-ns-lg` — use the `ns-*` prefixed variants, not raw Tailwind equivalents.

Light theme: warm parchment (`#FDFCF9`) bg, sealing-wax red accent (`#B91C1C`). Dark theme: deep charcoal (`#0E0E0D`) bg, vivid vermillion accent (`#EF4444`).

## Components Structure

`src/components/` is organized by domain:
- `ui/` — Radix UI primitives (shadcn/ui, do not modify)
- `editor/` — TipTap editor, slash commands, AI writing tools
- `layout/` — Navbar, Footer, SidebarPanel (+ `navbar/` subdir)
- `story/` — StoryMetadata, StoriesHeader (+ `characters/`, `places/` subdirs)
- `plot/` — Plot timeline and event editing
- `community/` — Story/chapter comments
- `guestbook/` — Per-user profile guestbook (entries, replies, votes)
- `web3/` — Wallet connect, fee cards, transaction status
- `common/` — Shared utilities (Modal, ConfirmDialog, ThemeToggle, Icons, etc.)
- `chat/` — Chatbot and floating chat button
- `explore/` — Discovery pages, plus the whole competitions UI (ledger, detail,
  host/entry dialogs, phase walkthrough)
- `seo/` — SEOHead, StructuredData

Every routed component lives under `src/routes/` — including the static legal
pages (`routes/Legal/`) and the route guard (`routes/PrivateRoute.tsx`).
`src/components/` holds only components that a route composes.

Most folders have an `index.ts` barrel; `AppBootstrap/`, `chat/`, `explore/`,
`guestbook/`, `plot/` and `ui/` do not — import directly from those.

## Environment Variables

### `functions/.env.local` — required, and gitignored

Every `defineString` param in `functions/src/` **must** have a value here.
A param with a `default` still prompts if the emulator cannot resolve it from a
file, and that prompt blocks startup *before any trigger is registered* — so
every function 404s, not just the one that owns the param, and the only
symptom is `Function us-central1-x does not exist, valid functions are:` with
an empty list.

`.env.local` is covered by `*.local` in `functions/.gitignore`, so a fresh
clone has none of this and hits the prompt. Current params:

```
AGENT_SERVICE_URL=http://localhost:8000
RECOMMENDATION_SERVICE_URL=http://localhost:8100
```

Frontend (`src/`, `packages/`). Verified against actual `import.meta.env` reads:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGE_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_FIREBASE_FUNCTIONS_REGION   # default us-central1
VITE_STORY_DATA_URL              # see the warning below
VITE_USE_EMULATORS               # default true in dev
VITE_MAX_AI_USAGE                # default 100 — keep aligned with MAX_AI_USAGE
VITE_AGENT_MCP_URL               # agents base URL for /mcp-connect
VITE_APP_NAME
VITE_SITE_URL

# Web3
VITE_CHAIN_ID                    # default 31337 (local Anvil)
VITE_RPC_URL
VITE_ANVIL_RPC_URL / VITE_SEPOLIA_RPC_URL / VITE_MAINNET_RPC_URL
VITE_TIPPING_CONTRACT_ADDRESS    # plus _ANVIL / _SEPOLIA / _MAINNET variants
VITE_USDC_TOKEN_ADDRESS          # plus _ANVIL / _SEPOLIA / _MAINNET variants
```

**`VITE_STORY_DATA_URL` must be set in any real deployment.** Unset, the bundle
falls back to the relative `/story-data`, which Firebase Hosting rewrites to
`index.html` — so every API call returns HTML with a 200 rather than failing.
`deploy.yml` fails the build rather than let that ship.

Cloud Functions (`functions/src/`) read only these:

```
MAX_AI_USAGE                # daily chat/AI quota — keep aligned with VITE_MAX_AI_USAGE
MAX_STORAGE_UPLOADS_PER_DAY
AI_MAX_INSTANCES            # max concurrent instances for AI functions
STORY_DATA_URL              # story-data base URL for the dual-read paths
CORS_EXTRA_ORIGINS          # comma-separated additional allowed origins
LOCAL_REDIRECT_URL
FUNCTIONS_EMULATOR          # set by the emulator itself
```

The competition/escrow variables that used to be listed here (`ESCROW_PROVIDER`,
`COMPETITION_FEE_BPS`, `INITIAL_TALE_GRANT`, `FAUCET_TALE_GRANT`) no longer exist
— that logic moved to story-data. story-data itself reads `DATABASE_URL`,
`AUTH_MODE`, `FIREBASE_PROJECT_ID`, `SERVICE_TOKEN` and `CORS_ORIGINS`.
