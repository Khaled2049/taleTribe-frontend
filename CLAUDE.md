# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev              # Start Vite dev server
yarn build            # TypeScript check + Vite production build
yarn build:analyze    # Build with bundle analysis (opens stats.html)
yarn lint             # ESLint — fails on any warnings
yarn preview          # Preview production build locally
yarn start:emulator   # Start Firebase emulators (runs from functions/)
yarn kill-ports       # Kill ports used by Firebase emulators
yarn test             # Vitest unit suite (tests/, excludes tests/rules/)
yarn test:watch       # Vitest in watch mode
yarn test:rules       # Firestore rules tests — needs a running emulator
```

`yarn lint` currently reports ~123 pre-existing errors, most of them
`no-explicit-any` in `src/types/`. Every file under `functions/src/` also fails
to parse under the root ESLint config (it cannot resolve `tsconfig.dev.json`
from there). Judge a change by whether it adds errors **in the files it
touches**, not by the total.

### Tests

Unit tests live in `tests/` and run under Node, not jsdom — they cover pure
logic only, never components. `tests/rules/` is excluded from `yarn test` and
run separately by `yarn test:rules`, which requires
`firebase emulators:start --only firestore`; a rules suite that silently passes
with no emulator is worse than no suite.

Modules reached by `tests/` must be listed in `tsconfig.test.json`. Two of them
live in `functions/src/` rather than `src/lib/` — `competitionSettlementCore.ts`
and `escrow/refundPlan.ts`. Both are deliberately **import-free** so vitest can
load them directly, and both are money arithmetic that must not be duplicated
into the frontend: divergent formatting is survivable, a divergent payout is not.

There is no component-level coverage. E2E lives in `cypress/e2e/`
(`story_lifecycle`, `chapter_generation`, `ai_chat`, `worldbuilding_indexing`)
and is not part of `yarn test` — run it with `yarn e2e`, which brings up the
whole stack via `scripts/e2e-stack.sh`, or `yarn cy:open` / `yarn cy:run`
against an already-running stack. Nothing covers competitions yet; that path is
verified by seeding the emulator (see below).

## Path Aliases

`@/` maps to `./src/` (configured in both `vite.config.ts` and `tsconfig.json`). Always use `@/` for imports — never use deep relative paths like `../../../`.

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
`SEOProvider` → `Web3Provider` (Wagmi + React Query) → `ThemeProvider` → `AuthProvider` → `AiUsageProvider` → `ChatProvider`

### Routing
All routes are defined in `src/main.tsx` using React Router v7. Every route is lazy-loaded. Key route groups:
- `/create/:storyId` — writing workspace (children: `/characters`, `/plot`, `/places`)
- `/story/:id` — public reader view
- `/user-stories` — author dashboard
- `/explore`, `/book-clubs`, `/library` — discovery

### Data Layer

**Cloud Functions API** (`src/api/index.ts`): Custom HTTP client that auto-attaches the Firebase Auth bearer token. Dev base URL points to local emulator (`localhost:5001`). Throws `ApiError` on failure.

**Firestore Services** (`src/services/`): All Firestore reads/writes go through service modules. Key ones:
- `StoriesRepo.ts` — story/chapter CRUD; enforces `WORD_LIMIT = 5000` and `CHAPTER_LIMIT = 50`
- `StorageService.ts` — Firebase Storage uploads (covers, images)
- `ImageGenerationService.ts` — triggers AI image gen via Cloud Function

**Custom Hooks** (`src/hooks/`): `useAutosave()` handles periodic draft saves to Firestore. `useEditorState()` manages TipTap state. Web3 hooks (`useEarnings`, `useTippingContract`, `useWalletState`, `useTokenBalance`) wrap Wagmi.

### Firebase
Config in `src/config/firebase.ts`. Set `VITE_USE_EMULATORS=true` (default in dev) to connect to local emulators:
- Auth: 9099, Firestore: 8080, Functions: 5001, Storage: 9199

Firestore subcollection pattern: `stories/{id}/chapters`, `stories/{id}/chats/{id}/messages`.

### AI Features
- **Chat**: Real-time Firestore subcollection + Cloud Function (`/sendChatMessage`) with story-context RAG
- **Brainstorm / Text Enhancement**: API calls to Cloud Functions
- **Daily quota**: UI display uses `VITE_MAX_AI_USAGE` (default 100) and user profile fields (`aiUsage`, `lastAiUsageDate`). Server-side enforcement is in `functions/src/aiSettings.ts` (`checkAiAccess` → `consumePlatformDailyQuota`), controlled by `MAX_AI_USAGE` env var. Keep `VITE_MAX_AI_USAGE` aligned with `MAX_AI_USAGE`. BYOK users bypass quota.
- **Indexing budget**: write-triggered (re)embedding is metered separately from the chat quota via `consumeIndexingBudget` (`functions/src/usageBudget.ts`), controlled by `MAX_INDEX_USAGE` (default 300/day), stored on the user doc as `indexUsage`/`lastIndexUsageDate`. Counts one unit per debounced embedding pass (not per autosave). Applies to BYOK users too — indexing uses the platform embedder regardless. Deletes are never gated.
- **Per-user story cap**: `users.storyCount` is maintained by the `onStoryWrite` trigger (`functions/src/storyCountTrigger.ts`); `firestore.rules` blocks story creation past `MAX_STORIES_PER_USER` (literal `100` in rules — keep both in sync). Soft cap; the indexing budget is the hard cost ceiling.

### Web3
Wagmi config in `src/blockchain/config.ts`. Target chain from `VITE_CHAIN_ID` (default 31337 for local Anvil). Tipping contract ABI in `src/blockchain/abi/TippingPlatform.abi.json`. Wallet state machine: `DISCONNECTED → CONNECTING → CONNECTED → READY` (or `WRONG_NETWORK / ERROR`).

### Competitions and TALE

TALE is an internal, non-redeemable token backing competition prize pools. It is
deliberately shaped like an ERC20 — 18 decimals, integer minor units, an asset
id — so replacing the off-chain ledger with a real token contract does not
change how amounts are represented. The `contracts` repo (`../contracts`) holds
only `TippingPlatform.sol` today; there is no TALE token and no escrow contract
yet.

**Money representation.** Every amount that crosses a boundary (Firestore, HTTP,
a module edge) is a base-10 integer string in minor units; every calculation
between is BigInt. Never a `number` — one whole TALE is 10^18 minor units, far
past `Number.MAX_SAFE_INTEGER`, so float arithmetic on a balance is silently
wrong. `functions/src/money.ts` and `src/lib/money.ts` are deliberate duplicates
(separate builds, no shared workspace) and are marked KEEP IN SYNC — change both.

**The ledger** (`functions/src/ledger.ts`) is double-entry. `transfer()` applies
a balanced set of postings exactly once, keyed by a server-derived
`idempotencyKey` that becomes the document id. Postings must sum to zero, no
posting may be zero, and an account may appear at most once per transfer.
Accounts: `user:{uid}`, `escrow:competition:{id}`, `platform:treasury`, and
`system:mint`. `system:` accounts are excluded from balance materialization —
correct for the mint, wrong for anything whose balance you want to read.

**Escrow is the swap seam.** `functions/src/escrow/EscrowProvider.ts` is the
entire boundary between competitions and money. Competition code calls
`getEscrowProvider()` and never a concrete implementation, so swapping
`LedgerEscrow` for a future `ChainEscrow` is a new file plus an env var. Three
chain realities are already built into the interface: `"pending"` is a
first-class result, payouts name a `userId` and never a wallet address, and
every mutating method takes an idempotency key. Gas, nonces, chain ids and ABIs
must never appear in these signatures — if one needs to, the leak belongs inside
the provider.

**Lifecycle.** `draft → open → voting → settling → settled`, with `cancelled`
branching off the first three. Phases are written only by Cloud Functions
(`competitionPhase.ts`, `competitionLifecycle.ts`, `competitionAdvanceTask.ts`)
because each transition moves money or decides who receives it.

**Entry fees.** Optional and set at creation; absent or `"0"` means free. The fee
is charged by `submitToCompetition` and refunded by `withdrawSubmission`, held in
escrow beside the prize rather than paid out on receipt — that is what makes
refund-on-withdraw a movement out of an untouched balance instead of a clawback.
It is revenue, not prize money: at settlement it splits between the platform and
the host by `feeBps`, mirroring `TippingPlatform.calculateSplit()`
(`floor(amount * bps / 10000)`, remainder by subtraction, cap 3000). `feeBps` is
stored on the competition document so changing the env cannot retroactively
re-split a running competition. Who paid what lives in
`competitions/{id}/contributions/{userId}`; `readHeldContributions` is the single
reader, and `refund()` takes an explicit `mode: "partial" | "final"` — `final`
asserts escrow drains to exactly zero.

**Invariants worth not breaking:**
- Escrow's balance is always `prizePool + entryFeesHeld`, and settlement refuses
  to pay out of a balance it cannot account for.
- Live vote counts live in `competitions/{id}/private/tally`, denied to every
  client — "results hidden until settled" is a rules guarantee, not an absence
  of UI. `votes/{voterId}` denies `list` for the same reason.
- Settlement claims `voting → settling` before anything else, so the tally is
  frozen and every retry recomputes a byte-identical result.
- A refund batches at 400 funders: `transfer()` writes one document per posting
  in a single transaction, Firestore caps that at 500, and a competition holds
  up to 500 entries.

**Seeding.** `functions/scripts/seed-competitions.js` builds every phase through
the real endpoints (`--list` for the roster, `--only=` to filter, `--reset` to
clear). Three scenarios charge entry fees so the multi-funder escrow paths get
exercised locally.

### Guestbooks and the follow graph

A guestbook is a per-user wall at `users/{ownerId}/guestbook/{entryId}`, with
`replies` and `votes` subcollections. `ownerId` is a path segment rather than a
field, which is what lets the rules grant the owner rights over anyone's entry
without a lookup.

**Who may post** is `publicProfiles/{uid}.guestbookPolicy`, one of `nobody |
following | mutuals | followers | everyone`. A missing profile, a missing field,
and a missing user doc all read as **`everyone`** — the setting is additive, so
accounts that predate it keep the open wall they had. It gates entry creation and
reply creation, and nothing else: votes and the `commentCount` bump stay
ungated, because the reply create fails first.

`mayPostOnWall()` in `firestore.rules` is the authority; `canPostOnWall()` in
`src/lib/guestbookPolicy.ts` only decides whether a compose form renders. KEEP IN
SYNC — the two matrices are asserted independently by
`tests/rules/wallPolicy.rules.test.ts` and `tests/guestbookPolicy.test.ts`.

Every `get()` in those rules is `exists()`-guarded. Rules `get()` on a missing
document returns null and dereferencing `.data` **errors, which denies** — it
does not fall back to a default, so an unguarded read fails closed for any
account whose document is absent.

**The follow graph** is bidirectional arrays: `users/{uid}.followers` and
`.following`. Storing both sides is what makes the policy resolvable from one
document in the rules, and lets a viewer answer "does the owner follow me?"
(`ownerId ∈ me.followers`) from their own doc — another user's doc is unreadable.
Follow and unfollow must stay a single `writeBatch`; a half-applied follow makes
the rules and the UI disagree. The arrays cap out around 30k uids (1 MiB), at
which point the shape becomes `users/{id}/followers/{uid}` documents.

**Search** is a username prefix range over `publicProfiles.usernameLower`, which
is derived — never accepted from a caller — in exactly two places:
`PublicProfileService.upsertPublicProfile` and `functions/src/adminUserService.ts`.
`publicProfiles` is listable by any signed-in member (capped at 30 per query),
which is what makes bio/occupation/location enumerable; that is the accepted
price of prefix search without a paid index.

Client writes to `publicProfiles` are merges, so the update rule checks
`diff().affectedKeys()`, not `keys()`. Using `keys()` there means any field the
client does not own locks the owner out of their own profile permanently.

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
- `pages/` — Static page content (PrivacyPolicy, TermsOfUse)

Most folders have an `index.ts` barrel; `AppBootstrap/`, `chat/`, `data/`,
`explore/`, `plot/` and `ui/` do not — import directly from those.

## Environment Variables

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGE_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_USE_EMULATORS          # default true in dev
VITE_MAX_AI_USAGE           # default 100 (daily quota display — server enforces MAX_AI_USAGE)
VITE_CHAIN_ID               # default 31337 (local Anvil)
VITE_AGENT_MCP_URL          # agents service base URL for the /mcp-connect consent page (default http://localhost:8000)
```

Cloud Functions read a separate set (`functions/src/`):

```
MAX_AI_USAGE                # daily chat/AI quota — keep aligned with VITE_MAX_AI_USAGE
MAX_INDEX_USAGE             # daily embedding budget (default 300)
MAX_STORAGE_UPLOADS_PER_DAY
AI_MAX_INSTANCES            # max concurrent instances for AI functions
ESCROW_PROVIDER             # "ledger" (default). Anything else throws — it will
                            # not silently pay real prizes with play money.
COMPETITION_FEE_BPS         # platform cut of entry fees (default 1000 = 10%, cap 3000)
INITIAL_TALE_GRANT          # free TALE materialized on first spend (default 1000)
FAUCET_TALE_GRANT           # TALE per faucet claim (default 250)
CORS_EXTRA_ORIGINS          # comma-separated additional allowed origins
LOCAL_REDIRECT_URL
```
