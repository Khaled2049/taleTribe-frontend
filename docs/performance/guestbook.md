# Guestbook home — performance and correctness review

Reviewed 2026-10-03. Frontend `43ebd11`; story-data `b2ee343`.

## Implementation progress

Work is on `perf/guestbook-improvements`, based on frontend `aec3f61`.
The review findings below describe the original baseline; this section records
the changes implemented since the review. The changes have not been browser-tested
or benchmarked. Integration tests are omitted at the user's request.
Current branch validation: `yarn build`, `yarn lint`, and `yarn test` pass
(452 unit tests). These checks do not measure browser loading time.

| Item | Status | Validation |
| --- | --- | --- |
| Follow/unfollow feed invalidation | Implemented | 8 unit cases; targeted lint and production build passed |
| Cross-view post mutations and reply counts | Implemented | 16 mutation unit cases; targeted lint and production build passed |
| Earlier feed requests/auth loading | Implemented | Route and hydration unit cases; targeted lint and production build |
| Cached reply threads | Pending | Current full-thread reads retained |

### 1. Follow/unfollow feed invalidation

Successful follow/unfollow operations cancel older feed reads and invalidate
only the captured viewer's All and Following feeds. Active feeds refetch;
inactive feeds refresh on their next visit. Delayed mutations cannot update
another account's follow list. The regression cases cover active/inactive caches,
failed writes, account switching, and an initial read finishing after a follow.
The reported button symptom still needs browser confirmation; the source-level
cache defect is fixed.

### 2. Cross-view mutation consistency

`src/lib/guestbookMutations.ts`, exposed through `useGuestbookMutations`, now
coordinates writes for both the combined feed and visited walls:

- Creating a post patches every existing eligible cache, regardless of the
  currently selected filter. Own posts never enter Following. A note on
  somebody else's wall enters All and that owner's wall, but not Just me.
- Temporary IDs are replaced by server entries; duplicate IDs are avoided,
  response order does not change chronological order, and failure removes only
  that operation's placeholder. Unfetched views are not seeded with an
  incomplete one-entry page.
- Successful deletion removes the entry from every loaded page and adjusts
  owner totals. Cursor/page parameters are preserved. Pagination now uses the
  server cursor instead of assuming a locally shortened page is the last page.
- Post votes and reply counts render from query data, eliminating independent
  post-card counters. Votes update every cached copy, coalesce overlapping
  clicks, and roll back vote fields without undoing concurrent reply changes.
- Writes cancel outdated feed reads; completion is scoped to the original
  viewer. Existing views are patched without re-downloading every loaded page
  after each post/vote/delete. Queries are marked stale for later visits, and
  cancelled initial active reads with no data are restarted.
- Reply create/delete still use the existing full-thread reload. They also
  invalidate parent feeds independently, so a failed thread reload does not
  leave the entry count permanently stale. Successful thread reads patch counts
  across cached post copies. Superseded/unmounted reads are ignored.
- Unsaved optimistic posts cannot be voted on, deleted, or replied to before
  the server assigns a real ID.

This step does not cache reply bodies or change the reply-vote implementation;
those belong with the pending reply-thread query work. It does not change APIs.
Active parent-feed reconciliation after reply writes can add a feed read until
the later reply-cache task can maintain exact counts directly.

### 3. Earlier feed requests and content

`prefetchGuestbookRoute` starts the first feed/profile read alongside the
relevant lazy route chunk on navigation. On a cold page, `AuthBootstrap` starts
it as soon as Firebase reports the viewer's identity, before Firestore user
hydration and profile/follow enrichment finish. The hook and prefetch share
query options and keys; repeat navigation within two minutes reuses the first
page. The navbar home link also starts the signed-in feed on hover, focus, or
touch intent. Signed-out home never requests a personal feed. Visited walls start their
profile and first entries together, using a viewer-scoped key; a self-visit
still redirects to the combined feed.

The signed-in home and a visited wall can show the feed after identity is known
while composer, follow controls, and policy details wait for the hydrated user.
Identity checks compare the React snapshot with the current Firebase uid so a
previous account's user object or feed cannot accompany the new account's
posts. `AuthBootstrap` also clears that object when the uid changes. The home
composer reserves a placeholder during this interval.

Within auth hydration, `getMe` and `getMyFollows` run in parallel. The full
`getMe` result seeds the shared public-profile cache, avoiding the subsequent
own-policy profile GET. A missing profile still follows the existing creation
path, and a failed profile read no longer discards a successful follow read.
Superseded hydration attempts cannot overwrite the newer account's state or
profile cache.

This is a request-order improvement, not a measured latency result. Recheck
first real post, request count, and layout stability in a Guestbook browser
benchmark before claiming a time reduction.

Validation: the mutation, follow-feed, policy, and signer suites pass together
(64 unit cases). These tests exercise an in-memory QueryClient with mocked API
writes; they are not browser/integration tests or latency measurements.

## Scope and evidence

The signed-in `/` renders `HomeRoute` → `src/routes/Guestbook/WallPage.tsx`.
`/guestbook` also renders `WallPage`. `GuestbookPage.tsx` handles
`/guestbook/:userId`; visiting your own profile redirects to `/guestbook`.
This review covers both feeds, their shared cards/replies/sidebars, authentication
bootstrap, query cache, and the story-data endpoints they call.

This is a **source review with a production build**, not a browser benchmark.
`yarn build` passed (TypeScript and Vite). No Guestbook browser trace, live bug
reproduction, database query plan, or before/after timing was collected. Request
counts below are derived from code, assuming empty application caches and
successful requests; they exclude assets, auth transport, retries, and app shell
requests unless explicitly included. See implementation progress above for
completed recommendations; the remaining sections retain the review baseline.

Prior evidence reviewed:

- [Stories benchmark](../../../../benchmarks/stories-page-2026-09-29/report.md):
  separate useful-content readiness from LCP and total request count; account for
  different quantities of prefetched content.
- [Story detail/reader report](../../../../benchmarks/story-detail-2026-09-30/report.md):
  shared query data, early requests, and conditional HTTP reads are useful
  precedents, but these were one-off measurements.
- [Editor baseline](../../../../benchmarks/editor-2026-09-30/report.md) and
  [after report](../../../../benchmarks/editor-2026-10-02/report.md): measure
  cold auth recovery separately from warm navigation, and verify that faster
  interactions still preserve correct state.

Those pages' timing improvements are not Guestbook measurements. Some older
recommendations are already implemented: Web3 is route-scoped, profile/policy
hooks share a key, following profiles are batched, and story-data supports gzip.

## Highest-priority findings

| Priority | Change | Main benefit | Owner |
| --- | --- | --- | --- |
| P0 | Invalidate viewer feed caches after follow/unfollow; verify reported filter failure | Correct “People I follow” results | Frontend auth store and Guestbook queries |
| P1 | Coordinate create/delete/vote/reply cache updates across feeds | Correct warm navigation without full reloads | Frontend |
| P1 | Start feed data and route code earlier; shorten auth hydration dependencies | Earlier useful posts | Frontend bootstrap/router |
| P1 | Cache reply reads and patch successful reply mutations | Fewer repeated reads and smaller transfers | Frontend |
| P1 | Mount desktop-only discovery only on desktop; defer closed mobile drawer work | Less mobile data and rendering | Frontend |
| P2 | Paginate large reply threads and inspect author-feed query plans | Bounded bytes, DOM, and database work | story-data and frontend |
| P2 | Memoize feed derivation/cards and index reply children once | Less main-thread work as feeds grow | Frontend |
| P2 | Use stable feed skeletons and explicit refresh/error states | Earlier orientation and less layout movement | Frontend |
| P3 | Tune fonts and deferred interaction code using a browser trace | Lower startup bytes and parse work | Frontend |

## Reported bug: “People I follow”

### What is connected correctly

`WallFilters.tsx` maps the exact label to `"following"` and calls `onChange`.
`WallPage` passes `setFilter`. `useWallFeed` includes both the filter and viewer
ID in its query key. `GuestbookRepo.listWall` sends
`GET /v1/me/wall?limit=10&filter=following`. The server's `ListPersonalWall`
filters **authors** through `user_follows`, not wall owners. Existing API tests
in `story-data/internal/httpapi/e2e/guestbook_test.go` cover these semantics;
they were inspected, not executed for this documentation change.

Consequently, posts by followed people on anybody's wall should appear. A
stranger's note on a followed person's wall should not. “All” and “People I
follow” can legitimately show identical posts when no other qualifying posts
exist. “Just me” actually means entries on the viewer's wall, including notes
from other people; its label deserves clarification.

### Confirmed source defect; likely explanation, not a live reproduction

`src/stores/authStore.ts` → `followUser` / `unfollowUser` saves the relationship
and updates `user.following`, but never invalidates the wall queries.
The following sidebar key contains the followed IDs and therefore changes.
The feed key is `["guestbook", "wall", filter, viewerId]` and does not change.
This lets the sidebar update while the feed remains unchanged.

`src/lib/queryClient.ts` supplies a two-minute `staleTime`, ten-minute `gcTime`,
and disables focus refetch. Switching to an already-fresh filter reuses its
old response. Expiring `staleTime` only makes data eligible for refetch; it does
not schedule a request. A mounted feed can remain old beyond two minutes.

Suggested regression scenario:

1. Viewer A does not follow B; B has a known post. Load both All and Following.
2. Follow B through New members or People, then choose People I follow before
   two minutes elapse. B's post must appear without reloading the app.
3. Unfollow B while those caches exist. Both relevant feeds must drop B's
   otherwise-ineligible posts. Notes on A's own wall still belong in All.
4. Repeat with a failed follow request: preserve the prior relationship and
   feed. Repeat with a cold filter cache to distinguish caching from API failure.

Fix after a successful relationship mutation: invalidate the captured viewer's
`all` and `following` wall queries. Refetch active queries; mark inactive ones
stale for their next visit. Guard account switches and handle in-flight reads
so an old result cannot overwrite the refresh. Do not include the whole follow
array in every feed key merely to force refreshes; that retains redundant feeds.

If the button still fails with a cold cache, inspect the outgoing filter,
response status/body, stored relationship, and auth identity. Source inspection
does not establish that the cache defect explains every instance of the report.
Add `aria-pressed={active}` to filter buttons for accessible state and reliable
interaction assertions. Distinguish a failed request from a legitimately empty
feed: today the error banner and “Your wall is quiet” can appear together.

## Current cold-load path

For an existing signed-in account with a Firestore user document and username:

```text
entry code → Firebase auth restoration
  → lazy Firestore user read → ID-token claims
  → GET /v1/profiles/me → GET /v1/me/follows → hydrated user
  → WallPage lazy import on signed-in /
      ├─ GET /v1/me/wall?limit=10&filter=all → real posts
      ├─ GET /v1/public/profiles/{viewer} → own guestbook policy
      ├─ GET /v1/public/profiles?ids=... → following sidebar/drawer
      └─ GET /v1/public/profiles?limit=20&sort=newest → New members
```

The last four requests can run concurrently. The following batch is omitted
when nobody is followed. That is **four route-level reads**, or three without
follows, plus the two story-data hydration reads on this normal cold path.
The route uses initials for post avatars and server-supplied author/owner names:
there is no per-post author lookup. Replies make no read until expanded.

On `/guestbook`, the lazy chunk can load during auth hydration; on `/`,
`HomeRoute` waits for hydration before rendering the lazy page. Neither route
has the data prefetch used by `/stories` and story detail.

For a visited wall, profile and policy share **one** profile query. The page
waits for that profile before mounting `Guestbook`, so entries start one round
trip later. Following profiles are another optional batch. `GuestbookSigners`
shares the entries query: it does not add another HTTP request.

### Shorten the critical path

- Separate “Firebase identity is resolved” from “all profile/relationship
  enrichment is loaded.” Feed eligibility is evaluated server-side; its request
  need not wait for the client's follow list. Preserve signup/profile creation
  and authorization gates while starting reads earlier.
- Where account lifecycle permits, load own profile and follows concurrently.
  Keep profile self-healing dependencies explicit. Hydration already obtains
  a full public profile but does not seed the shared public-profile query;
  safely seeding that exact shape can remove the later own-policy GET.
- Extract reusable wall query options for both the hook and prefetch. On
  authenticated navigation intent, start the chunk and first page together.
  For cold `/`, begin once identity is settled rather than speculatively
  fetching another account's data. Preserve viewer-scoped keys and sign-out
  clearing in `AuthBootstrap`.
- For `/guestbook/:userId`, start profile and first entries concurrently when
  viewer identity is known. Keep missing-profile/error handling and the self
  redirect; avoid first fetching anonymously and immediately duplicating the
  entries request after auth resolves.

## Caching and network round trips

### Keep the existing wins

Feeds use infinite queries with ten entries per page, two-minute freshness,
and viewer-specific keys. Profile, policy, and wallet hooks share one
five-minute profile cache. Following sidebar/drawer share a five-minute batch
query capped at 50 IDs. `usePeopleQueries` still describes per-UID reads in a
comment, but `ProfileRepo.getMany` actually makes one batch request.

### Make cache updates consistent before lengthening freshness

`useAddWallEntryToCache` / `useRemoveWallEntryFromCache` modify only the current
filter. Owner-wall cache helpers modify only that wall. Posting in All can
leave a previously cached Just me empty; deleting in one view can leave the
entry visible in another. Posting while Following is selected skips the feed
patch entirely, so existing All/Just me caches are not refreshed either.

`WallPostCard` initializes vote and reply counts from props into component
state. Votes change that local state without patching query data, so remounting
can restore old values. A query refetch also does not automatically synchronize
already-mounted local counters.

Use common mutation helpers to patch known matching copies and invalidate
affected inactive lists. Cancel or otherwise reconcile in-flight reads before
optimistic writes, replace temporary IDs with server results, and roll back on
failure. Preserve cursor metadata, deduplicate IDs, and keep own posts out of
Following. Prefer counts/votes in query data with transient pending state rather
than independently maintained card copies.

### Cache replies

`GuestbookReplies.tsx` uses local state and an effect. Collapse unmounts it;
reopening triggers another full-thread GET. Create, edit, and delete each wait
for a write and then reload the entire thread. The server joins current author
names already, so no extra author lookup is needed.

Use a viewer-scoped replies query keyed by owner and entry. A fresh reopen
should require zero reads. Patch create/edit from their returned reply, and
remove a deleted subtree consistently with server behavior; reconcile parent
entry counts across cached feeds. Show failed reads with retry rather than
silently displaying “No replies yet.” Keep initial reply fetching demand-driven.

### HTTP caching

Gzip already wraps the API in `internal/httpapi/server.go`. Verify production
headers and actual wire bytes rather than proposing another compression layer.
Guestbook handlers use ordinary `respond`, not the story endpoints'
`respondCacheable` helper.

Do not copy public story CDN cache headers onto `/v1/me/wall`. Even
`/v1/public/guestbooks/...` is viewer-dependent because optional auth supplies
`userVote`. Prefer application caching first; any HTTP policy must isolate
identities and preserve vote freshness. If adding private conditional reads,
note that a body-derived ETag still runs the database query and still requires
a network round trip. A shared anonymous representation would require separating
viewer state deliberately. Redis is not the first intervention; measure SQL
and hit rates before introducing a second cache and invalidation system.

## Bytes transferred

Fresh `yarn build` output (decimal kB; gzip estimates, not observed transfer):

| Emitted file | Minified kB | Gzip kB |
| --- | ---: | ---: |
| Entry `index-i5ISbNfJ.js` | 647.92 | 183.75 |
| `WallPage-CCPeHUIO.js` | 13.94 | 4.60 |
| `GuestbookPage-BzyRy0UJ.js` | 13.75 | 4.94 |
| `useGuestbookQueries-BpKtanGd.js` | 18.56 | 5.60 |
| `FollowingSidebar-CaIOqeUQ.js` | 7.16 | 2.48 |

These are individual chunks, not a complete route dependency total. Chunk
names do not imply they contain only the named module. The build reports the
usual >500 kB chunk warning; it does not establish a measured Guestbook slowdown.

- On mobile, `NewMembers` is CSS-hidden but mounted: it fetches 20 profiles to
  show zero visible suggestions. Mount it only on desktop. Desktop displays at
  most four suggestions; retain the shared directory page if reuse is valuable,
  or measure a smaller purpose-specific response before adding an endpoint.
- The following batch is also eager on mobile before opening the drawer.
  Conditionally mount the desktop sidebar and enable mobile fetching on open
  or intent. Fixing only the drawer is insufficient while the hidden sidebar
  still subscribes. The current 50-profile cap bounds transfer but needs a clear
  “show all” path for larger follow lists.
- Replies, recursive reply UI, and confirmation UI are statically reachable
  from every card. Consider lazy-loading reply UI on interaction, with intent
  preloading to avoid adding click latency. Verify savings against the shared
  chunk graph before splitting tiny controls.
- `index.html` still requests three Google font families and 20 weight/style
  combinations. Audit the faces used above the fold, reduce unused variants,
  and consider self-hosting/preloading the critical face. Requested variants
  are not evidence that all 20 font files actually transfer on this page.
- Main post avatars are initials, so image optimization is secondary here.
  New-member photos already use lazy loading and async decoding; serve small
  variants if their source assets are oversized.
- Reply lists are unpaginated in both client and server. Large threads need a
  paginated contract that preserves parent/child context, rather than just a
  frontend rendering cap after downloading everything.

## Main-thread and server work

`WallPage` flattens every cached page and calls `groupByDay` on each parent
render. Date grouping formats dates repeatedly. `WallPostCard` is not memoized,
so feed-level pending-state changes and appended pages re-render existing cards.
Memoize derived rows and cards with stable inputs; keep composer text local
(it already is). Include a day-boundary strategy if memoizing “Today” labels.

Both following presentations are mounted. The closed drawer retains its person
links, and the CSS-hidden desktop list retains its hooks/DOM. Render only the
applicable presentation and avoid populating a closed panel unnecessarily.
This duplicates sidebar work, **not** the entire post feed.

`GuestbookReply` filters `allReplies` for every reply's children. Building a
parent-ID → children map once avoids repeated scans approaching quadratic work
for large rendered threads. Loaded posts also accumulate without virtualization.
Profile a long session before adding virtualization; evaluate
`content-visibility` for offscreen cards with focus, find-in-page, and height
stability checks.

The visited-wall infinite-scroll observer uses the viewport while
`NavbarWrapper` scrolls an inner `<main>`. Its `200px` root margin cannot reliably
prefetch beyond that clipping container. Use the actual scroll container as
root. The combined home feed instead uses an explicit Older posts button, so
this observer issue does not apply there.

Server follow-ups, requiring query-plan evidence before changes:

- `ListPersonalWall` performs an author-follow filter and descending
  `(created_at, id)` ordering. Current migrations provide an owner/time index
  but no matching author/time index. Test author/time and global time indexes
  against realistic follow graphs. The All filter's OR may need a different
  plan; do not assume one new index fixes every filter.
- Reply counts, two vote counts, and the viewer vote are correlated subqueries
  per candidate entry. Page size is bounded, so measure before denormalizing
  counters and adding write complexity.
- `ListGuestbookEntries` performs an extra total-count query on every page,
  while the UI takes the total only from page zero. Consider returning it only
  on the first page with an explicit client contract.

Any API/schema implementation belongs in story-data and must follow its
service guide; clients should continue using the API rather than PostgreSQL.

## Time before useful content and error behavior

Replace the shared full-screen route spinner and feed spinner with a stable
Guestbook shell and post-shaped placeholders. Keep layout consistent through
auth, chunk, and data loading. Existing posts can stay visible during a
same-filter background refresh, accompanied by an updating indicator.

For a different filter, immediately show its cached results or a clearly
identified loading state. Do not silently show All posts under the Following
label. Reserve appropriate feed space to reduce filter-switch collapse/jumps.
Keep feed errors separate from empty states and provide an explicit Refresh
action; this is especially useful with focus refetch disabled and no live
subscription for PostgreSQL guestbooks.

Secondary correctness findings worth testing alongside the work:

- Combined-feed cards lack `GuestbookPolicyContext.Provider`, so reply UI
  defaults to `canPost: true` even on another owner's restricted wall. The API
  still enforces policy; expose eligibility without an N-per-post profile
  waterfall, or clearly handle server rejection.
- The mobile drawer locks `document.body`, but the actual scroll container is
  `<main>`. Verify background scrolling and keyboard focus; closing a panel
  with transforms/`aria-hidden` alone does not remove its links from tab order.
- A visited profile request failure falls through to “doesn't exist,” masking
  network/server errors. Its comment also claims anonymous reads are disabled,
  but `usePublicProfile` currently performs public reads when an ID exists.

## Measurement and acceptance plan

Create a separate Guestbook benchmark dataset before implementing optimizations.
Use the existing harness conventions: production builds, fixed account/data,
desktop/mobile, 4× CPU slowdown, 150 ms latency, 1.6 Mbit/s down, five alternating
before/after runs per scenario. Record commit IDs, viewport, cache/auth state,
fixture size, medians and ranges. Do not report estimates above as timings.

Exercise cold signed-in `/`, direct `/guestbook`, warm return from People,
visited walls, all three filter switches, and sign-out/account switch. Fixtures
should include no follows, more than 50 follows, enough posts for several pages,
distinct authors/wall owners, and large nested reply threads.

Record:

1. Time to first frame containing a real post (or a verified empty state),
   composer usability, filter-result readiness, LCP and CLS separately.
2. JS/CSS/font/image/API transfer bytes, decoded API bytes, cache hits,
   request counts by endpoint, and dependency waterfalls.
3. Long tasks/main-thread time, DOM/card count after multiple pages, and
   interaction latency for filters, reply opening, voting, and typing.
4. Correctness: fresh follow/unfollow results, no deleted-post resurrection,
   votes/counts surviving view changes, failed mutation rollback, policy errors,
   and no prior-account feed display.

Concrete structural targets: no hidden New-members GET on mobile; no reply GET
on a fresh cached reopen; no unnecessary own-policy read after safely seeding
hydration data; and immediate feed refresh after a successful relationship
change. Prefetch must reduce time to useful posts without changing which posts
qualify or fetching every filter on startup.

For implementation, run targeted regression tests and `yarn build`. Cross-service
changes additionally require `go test ./...` in story-data and integrated
verification through the workspace's `./dev-new.sh`. This review changed only
documentation and did not restart the local stack.
