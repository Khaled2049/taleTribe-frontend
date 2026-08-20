# Frontend architecture

How this codebase is laid out and where to put new code. If you are reading one
document before your first change, read this one.

For the migration this structure came out of, see
[micro-frontend.md](./micro-frontend.md). For the platform as a whole — agents,
contracts, story-data, creditProxy — see the workspace-root `CLAUDE.md`.

---

## The 30-second version

React 19 + TypeScript + Vite. One app at the repo root, plus two local packages
under `packages/`. Three different backends, and knowing which one you need is
the single most important thing to learn early.

```
taleTribe-frontend/
  src/            the app
  packages/       shared libraries the app consumes
  functions/      Firebase Cloud Functions (separate build, separate npm install)
  tests/          node-only unit tests
  cypress/        end-to-end
  terraform/      infrastructure
```

`yarn dev` runs the frontend alone. `./dev-new.sh` from the workspace root runs
the whole platform — PostgreSQL, story-data, creditProxy, Firebase emulators,
the agents service, and Vite — and seeds `dev@novelsync.local` / `dev123456`.

---

## Which backend am I talking to?

The app calls three things. They are not interchangeable, and picking the wrong
one is the most common way to make a mess.

| Backend | Reach it via | Use it for |
| --- | --- | --- |
| **story-data** (PostgreSQL) | `@novelsync/story-data-client` | Stories, chapters, characters, places, plots, comments, profiles, guestbooks, reading history, book clubs, competitions |
| **Firestore** | `firestore` from `@novelsync/platform-auth` | Realtime chat, and legacy data not yet migrated |
| **Cloud Functions** | `@/cloudFunctions` | AI generation, credits, storage uploads, anything needing a server secret |

**Default to story-data.** It owns most product domains. Do not add new Firestore
writes for a domain story-data already owns — that rule exists because the
cutover is finished for those domains and a stray write splits the source of
truth.

Firestore is still correct for two things: realtime chat (`ChatService.ts`,
book club messages), where a snapshot listener genuinely beats polling, and
data that predates the cutover.

Cloud Functions are for work the browser must not do — anything holding an API
key, spending credits, or moving money.

---

## The packages

Two local workspaces. Both are source-only: no build step, resolved straight to
their `src/index.ts` by Vite and TypeScript path aliases.

### `@novelsync/story-data-client`

Everything about talking to story-data.

```
packages/story-data-client/src/
  config.ts    configureStoryData({ baseUrl, getAuthContext, getUid })
  request.ts   the single request() every repo calls
  errors.ts    StoryDataError, StoryDataConflictError, isNotFound()
  repos/       the seven repos
  types/       the wire types they map to
```

**One rule governs this package: it must never import firebase.**

Not stylistic. `authStore` imports `profileRepo`, so if the client imported
Firebase auth the two packages would form a cycle. Instead the app injects a
token provider at bootstrap (`src/components/AppBootstrap/AuthBootstrap.tsx`).
The side benefit is that the package loads under vitest, where `import.meta.env`
and `auth.currentUser` do not exist — which is why the transport has tests and
the old hand-rolled versions never could.

If you need the current user inside a repo, take it from
`getStoryDataConfig().getUid()`. Do not reach for the Firebase SDK.

**Errors carry a status.** Branch on it, never on message text:

```ts
import { isNotFound } from "@novelsync/story-data-client";

try {
  return await storyWorkspaceRepo.getStory(id);
} catch (error) {
  if (isNotFound(error)) return null;
  throw error;
}
```

Matching on `message.includes("(404)")` looks equivalent and is not: the server's
own `{ error }` body replaces the generated message, so the check misses exactly
the responses it was written for. That bug shipped more than once.

### `@novelsync/platform-auth`

Firebase initialization and identity. Nothing else.

```
packages/platform-auth/src/
  firebase.ts        app init, emulator wiring; exports auth/firestore/storage/functions
  identity.ts        getAuthContext() async token · getCurrentUid() sync uid
  useAuthIdentity.ts { uid, email, isAdmin, loading, isSignedIn }
```

Never call `initializeApp` anywhere else. Import `auth` or `firestore` from this
package.

`useAuthIdentity()` reads the Firebase SDK directly through
`useSyncExternalStore` rather than mirroring it into a store — one source of
truth for who is signed in. Reach for it when you only need identity.

For the user's **profile** — username, bio, follow graph — you want
`useAuthContext()` from `src/contexts/AuthContext.tsx`, which is a different
thing living in the app. See the trap below.

---

## State: which tool for what

| Tool | Use for | Where |
| --- | --- | --- |
| **React Query** | Anything from a server | `src/hooks/queries/` |
| **Zustand** | Client state outliving one component | `src/stores/` |
| `useState` | Everything else | in the component |

Server data goes through React Query. One hook file per domain
(`useStoryQueries`, `useGuestbookQueries`, …) and **all** cache keys come from
`src/hooks/queries/queryKeys.ts`. Inventing a key inline is how invalidation
silently stops working.

Zustand holds the rest: `authStore` (the signed-in user's profile), `chatStore`,
`themeStore`, `readerSettingsStore`, `demoStore`. Only preferences persist —
never auth or chat.

---

## Naming traps

Three places where the name will mislead you. All three are real and none are
scheduled to change today.

**`src/contexts/` contains no contexts.** Not one of the six files calls
`createContext`. `HelmetProvider` and `Web3Provider` are three-line wrappers
around third-party providers (react-helmet-async, wagmi). `AuthContext`,
`ThemeContext` and `ChatContext` are ~15-line selector hooks over Zustand
stores. `DemoModeProvider` renders `<>{children}</>` and flips a store flag on
mount. So `useAuthContext()` does not read a context, and there is no
`AuthProvider` in the tree.

**`authStore` is mostly a profile store.** Of its members, only the identity part
is auth; `hydrateUser`, `followUser`, `unfollowUser` and `updateProfile` are
profile and follow-graph concerns. That is why it imports `profileRepo` and the
query client, and why it has not moved into `platform-auth`.

**`*Service` vs `*Repo` means nothing consistent.** `CompetitionService` and
`TokenService` are story-data clients that happen to be named Service.
`bookClubRepo` lives under `src/routes/BookClub/`, not `src/services/`, and mixes
story-data calls with Firestore chat. Read the imports, not the filename.

---

## Where code lives

```
src/
  main.tsx          every route, all lazy-loaded
  NavbarWrapper.tsx layout shell (hides the navbar on /create)
  cloudFunctions/   Cloud Functions HTTP client (transport + typed wrappers)
  blockchain/       wagmi config, tipping contract ABI
  components/       by domain — see below
  contexts/         providers + store selector hooks
  hooks/            general hooks; hooks/queries/ is React Query
  lib/              pure logic: money, pagination, competition phases, policies
  routes/           page components
  cloudFunctions/   Cloud Functions client: transport + one wrapper per domain
  services/         stateful modules owning a connection or cache (mixed backends)
  stores/           Zustand
  types/            types NOT owned by story-data
```

`src/components/` is organized by domain: `ui/` (shadcn primitives — do not
modify), `editor/`, `layout/`, `story/`, `plot/`, `community/`, `guestbook/`,
`web3/`, `chat/`, `explore/` (which also holds all competitions UI), `seo/`,
`common/`. Routed components — including the static legal pages — live in
`src/routes/`, never here.

Most folders have an `index.ts` barrel. `AppBootstrap/`, `chat/`, `data/`,
`explore/`, `plot/` and `ui/` do not — import directly from those.

**Always import with `@/`.** Never `../../../`.

---

## What happens at startup

The provider tree is flatter than you might expect, because most shared state is
Zustand rather than context:

```
SEOProvider                        react-helmet-async
  QueryClientProvider              the single app query client
    Web3Provider                   wagmi
      AuthBootstrap                renders null; wires onAuthStateChanged
      RouterProvider               every route, lazy
      ThemeToaster
```

`AuthBootstrap` is the piece worth knowing. It renders nothing, and it does two
jobs: at module load it calls `configureStoryData(...)` to hand the client its
base URL and token provider, and on mount it subscribes to `onAuthStateChanged`
to hydrate `authStore` and clear the query cache when the signed-in user changes.

The `configureStoryData` call is at module scope rather than in an effect
deliberately — a route loader can fire a repo call before any component mounts,
and an unconfigured client throws.

## How a request actually flows

Signed-in read of a story workspace:

1. Component calls a hook from `src/hooks/queries/useStoryQueries.ts`
2. React Query checks its cache under a key from `queryKeys.ts`
3. On a miss, the hook calls `storyWorkspaceRepo` from the package
4. The repo calls the shared `request()`
5. `request()` asks the injected `getAuthContext()` for a Firebase ID token
6. `fetch` goes to `/story-data/...` — proxied to `localhost:8084` in dev by `vite.config.ts`
7. story-data verifies the token and answers
8. Non-2xx becomes a typed `StoryDataError` carrying `status`
9. The repo maps the wire shape to a domain type
10. React Query caches it

Writes add one step: mutating endpoints send `If-Match` with a revision, and a
409 comes back as `StoryDataConflictError`. If you are editing a story or a
worldbuilding entity, you must carry the revision through — the repos track it
for you in a `revisions` map, but a caller inventing its own payload will lose it.

---

## Styling

The design system is called **Inkwell**, and it is CSS-variable-backed Tailwind
tokens. Use the tokens, never hardcoded colors.

Colors are `ns-`-prefixed: `ns-bg`, `ns-surface`, `ns-elevated`, `ns-ink`,
`ns-ink-secondary`, `ns-ink-muted`, `ns-accent`, `ns-gold`, `ns-border`,
`ns-destructive`. Also `shadow-ns`, `rounded-ns`.

Three faces, each with a job: `font-heading` (Cormorant, titles), `font-body`
(Crimson Pro, prose), `font-ui` (Hanken Grotesk, labels and controls).

Light is warm parchment with a sealing-wax red accent; dark is deep charcoal with
vermillion. Both come free if you use the tokens.

---

## Testing

| Command | What it runs | Needs |
| --- | --- | --- |
| `yarn test` | `tests/` — pure logic, node env | nothing |
| `yarn test:rules` | `tests/rules/` — Firestore rules | a running emulator |
| `yarn e2e` | Cypress, full stack | brings the stack up itself |
| `yarn build` | `tsc -b` + Vite bundle | nothing |
| `yarn lint` | ESLint | nothing |

`tests/` runs under **node, not jsdom** — pure logic only, no components. There
is no component-level coverage; the browser paths are Cypress's job.

Two things will trip you up:

- A module reached by `tests/` must be listed in `tsconfig.test.json`, including
  `packages/story-data-client/src` as a whole directory. Nothing under
  `functions/src/` is reachable from `tests/`.
- `yarn lint` reports **89 pre-existing errors**, and every file under
  `functions/src/` fails to parse under the root config. Judge your change by
  whether it adds errors *in the files it touches*, not by the total.

---

## KEEP IN SYNC pairs

Nothing mechanical enforces these. Breaking one is silent.

| These must match | Why |
| --- | --- |
| `src/lib/money.ts` ↔ story-data's amount arithmetic | The ledger lives in `story-data/internal/store/competitions.go`; this is the frontend's formatting copy. Divergent formatting is survivable; a divergent payout is not. |
| `src/lib/guestbookPolicy.ts` ↔ `story-data/internal/store/guestbook.go` (`canPostGuestbook`) | The client decides whether a compose form renders; story-data decides whether the write lands. Guestbooks left Firestore, so the rules no longer have an opinion. |
| `VITE_MAX_AI_USAGE` ↔ `MAX_AI_USAGE` | Display quota vs. enforced quota. |

---

## Adding a feature

**A new story-data-backed screen**

1. Add the endpoint call to the right repo in `packages/story-data-client/src/repos/`, or add a repo if the domain is new
2. Add wire types under `packages/story-data-client/src/types/`, export from the package index
3. Add a query hook in `src/hooks/queries/`, with its keys in `queryKeys.ts`
4. Build the component under the matching `src/components/` domain folder
5. Register the route in `src/main.tsx`, lazy-loaded like its neighbours

**Money, or anything competition-related**

Read the Competitions section of `CLAUDE.md` first. Every amount crossing a
boundary is a base-10 integer string in minor units and every calculation between
is `BigInt` — never `number`. One TALE is 10^18 minor units, far past
`Number.MAX_SAFE_INTEGER`, so float arithmetic on a balance is silently wrong.

**Anything touching a secret**

It goes in a Cloud Function. The browser never holds an API key, and never
receives a database connection string.

---

## Environment

`VITE_USE_EMULATORS` defaults to true in dev. Emulator ports: Auth 9099,
Firestore 8080, Functions 5001, Storage 9199. story-data is 8084, proxied at
`/story-data`.

`VITE_STORY_DATA_URL` matters in production: unset, the bundle falls back to the
relative `/story-data`, which Firebase Hosting rewrites to `index.html` — so
every API call would return HTML with a 200. CI fails the build rather than let
that ship.
