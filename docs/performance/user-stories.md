# `/user-stories` performance analysis

Reviewed 2026-10-03. Frontend `b94523d`; story-data `b2ee343`.

## Scope and evidence

This is a source review and a fresh production build (`yarn build`, passed), **not a browser timing benchmark**. Request counts below follow the code for a signed-in user with an empty query cache; they exclude Firebase auth/profile hydration, static assets, image requests, retries, and transport-level batching. The build's gzip figures are estimates for emitted files, not observed route transfer. No `/user-stories` payload capture, React profile, chain RPC trace, database plan, or first-content measurement was taken.

The [stories-page benchmark](../../../../benchmarks/stories-page-2026-09-29/report.md) measured a different, public route: first-grid time fell from 3.92–4.24 s to 2.07–2.10 s after route prefetch, smaller list responses and less initial rendering. The [editor benchmark](../../../../benchmarks/editor-2026-10-02/report.md) measured navigation *from* My Shelf and cold editor refresh; its 4.39 s cold-refresh result is editor-ready time, **not** shelf load time. Those reports establish useful techniques, not a shelf baseline.

## Current path to useful content

```text
navigation to /user-stories
  → lazy UserStories chunk + Web3Provider, under a full-screen spinner
  → Firebase identity restoration and authStore profile/follow hydration
  → useAuthContext().user gains a uid
  ├─ GET /v1/stories (owner-only, all stories, full list fields)
  │    → for each story: two readContract(storyEarnings) calls in parallel
  │    → Promise.all for every story → writing rows, counts and earnings
  └─ GET /v1/me/reading-history?limit=5 → Continue Reading cache
```

`UserStories.tsx` mounts both queries regardless of the active tab, which starts on **My Writing**. The two HTTP GETs can run in parallel once the hydrated `user` exists, but the writing list is held behind the chain reads: `useUserStoriesWithEarnings` resolves only after `Promise.all` finishes. The code makes **2N contract reads for N stories** when a public client exists (N=0 makes none). Viem or the RPC transport may batch those into fewer HTTP exchanges; the number of underlying network round trips and their latency need a trace. Each failed contract read is converted to zero, so a chain outage can silently look like zero earnings. A chain switch changes the query key and repeats the story-data GET as well as all earnings reads.

The current loading gate (`authLoading || (!!user && storiesPending)`) prevents a false empty state during hydration, but ties first rows to profile/follow work and to the slowest chain result. The page already has four row-shaped skeletons after its chunk mounts; the outer `Suspense` still shows a full-screen spinner while the chunk and provider load. The heading and New Story action appear once the page mounts, but real story titles do not appear until the entire combined query resolves.

There is no `/user-stories` loader or link-intent prefetch. By comparison, `/stories` and the editor have route prefetch paths. The account menu and mobile menu links simply navigate here.

## Caching and network round trips

- **Already present:** the combined shelf query is scoped by uid and chain id, has a five-minute `staleTime`, and lives in the app-wide React Query cache (10-minute default garbage collection; no focus refetch). A warm return within five minutes can show cached rows without another shelf GET. Mutations invalidate the `user.stories(uid)` prefix after success, so they refresh the list. AuthBootstrap clears the entire query cache on account change.
- **First change:** split story metadata and chain earnings into separate queries. Render the sorted list as soon as `GET /v1/stories` returns; fill earnings in later. Key the owner list by uid alone, and key earnings by story ids and chain id. A chain switch should refetch earnings without re-reading unchanged story metadata. Keep earnings failures distinct from actual zero, and retain the five-minute owner-list freshness policy unless product freshness needs a different value.
- **Start earlier:** use Firebase identity (`useAuthIdentity`/`getCurrentUid`) to start the owner-list request once a uid is known, as the editor and guestbook paths already do. Add a route loader or auth-bootstrap prefetch plus hover/focus/touch prefetch on the My Shelf links. Prefetch the route chunk alongside the GET. Avoid launching an owner request for an unknown or signed-out identity; continue clearing the cache on account change. The route should use `RequireAuth` or equivalent identity gating for a signed-out visitor, since today it can show an empty shelf and New Story button.
- **Defer secondary reads:** reading history is a separate GET for a tab that is initially hidden. Fetch it when Continue Reading becomes active, or prefetch it at low priority after writing rows appear. This removes one GET from the critical path and avoids it entirely for writing-only visits. Preserve a distinct loading/error state when that tab opens. `ReadingHistoryRepo.getRecentlyRead` currently catches errors and returns `[]`, so the tab may incorrectly say “Nothing in progress” after a network failure.
- **Mutation refreshes:** `useDeleteStory`, `useTogglePublishStory`, `useUpdateStoryMetadata`, and `useUpdateStoryCover` invalidate the whole shelf after success. Patch or remove the affected cached row from the mutation result where it carries enough fields; for publish and cover changes, update aggregates carefully or use a targeted background reconciliation. This saves an immediate full-list GET on common writes. Some mutations currently read the individual story first; that is a separate interaction cost.

For a cold shelf with N stories, the current route issues **two story-data GETs plus 2N logical chain reads**, after auth hydration. Splitting earnings does not necessarily reduce chain work by itself; it removes it from the path to visible rows. Lazy reading history removes one initial GET. Caching earnings by story and chain, a bounded concurrency policy, and using a multicall/batch facility *if the configured chain supports it* can reduce repeated RPC work; measure the actual transport before choosing a batch strategy.

## Bytes transferred and server work

The fresh build emits `UserStories-DzVOi6hj.js` at **134.09 kB minified / 40.42 kB gzip**. Its static imports include `StoryMetadataModal-BS0Uoclf.js` (**48.00 / 11.58 kB**), even though creation is closed initially. The route also waits on `Web3Provider-BBZrsdgq.js` (**26.21 / 9.50 kB**) and its dependencies. The main app chunk is **664.52 / 188.23 kB**. These file sizes overlap through shared chunks; summing them would overstate route transfer. The shelf chunk contains EPUB export code (`JSZip` is imported by `epubExport.ts`) and StoryRow imports cover generation and both edit dialogs, although those actions are behind user interaction.

Split the closed creation/edit dialogs, cover-generation panel, and EPUB exporter behind dynamic imports. Keep the small row shell in the initial chunk, and load action code when the control is opened or used. A build comparison and a route network trace should verify how many bytes this actually removes; moving code into a separate chunk without delaying its import saves nothing. After decoupling earnings from the list, evaluate whether Web3Provider can mount only when earnings or wallet actions are needed. Any provider change needs a wallet-flow check.

`GET /v1/stories` sends every owner story, with description, tags, cover and thumbnail URLs, edit fields, and count/rating aggregates. There is no limit or pagination. The server executes one list SQL query with scalar aggregate subqueries, then `hydrateTags` performs **one more SQL query per story**. This is a server round-trip and response-size scaling issue, even though it is one HTTP request. The browser sorts the already `updated_at DESC` list again and mounts every row; for a large library, JSON parse, date conversion, sorting and row rendering grow with N. A paginated owner endpoint with a compact shelf DTO and batched tag loading would bound all three costs. Keep the fields needed for the initial rows and for edit actions, or fetch full metadata on edit; preserve revision data for `If-Match`. Measure real payloads and query plans before setting a page size. The API applies gzip to eligible responses, but this private owner endpoint uses ordinary `respond` and has no explicit ETag/Cache-Control. Keep any HTTP validator **private and uid scoped**; never put drafts in a shared cache. The in-memory React Query cache is already the primary warm-navigation win.

Story covers use `thumbnailUrl || coverImageUrl`, `loading="lazy"`, and `decoding="async"`. Check whether the first visible cover's lazy request starts promptly and whether old stories fall back to a full-size image. Give covers explicit intrinsic dimensions and serve a suitably sized thumbnail; prioritize the first visible cover only if a trace shows it matters for LCP.

## Main-thread work and first paint

The list is rendered in full with `sortedStories.map(StoryRow)`; each row has local state and event effects, and the parent scans the list several more times for counts and earnings totals. Those passes are linear and probably minor for a small shelf. The larger candidate costs are parsing/evaluating the shelf's action code and mounting a very large row list. Defer action modules first, then profile a large owner fixture before adding virtualization or pagination. Prefer server pagination if the HTTP payload and SQL work also grow with N. Removing the duplicate client sort is a small, safe cleanup after confirming server ordering remains contractual.

Use one shelf-shaped `Suspense` fallback so the heading, tabs, stats placeholders and row slots retain their geometry from chunk load through data load. After splitting the queries, rows can replace placeholders when story-data responds while earnings and reading history continue independently. Keep an explicit story-list error state: currently `stories = []` allows the “No stories yet” empty state to render alongside a fetch error.

## Recommended order and verification

| Priority | Change | Expected effect | Owner |
| --- | --- | --- | --- |
| P0 | Split owner list from earnings; render rows on list arrival | Earlier useful content; chain failures no longer hide stories | Frontend |
| P0 | Gate prefetch on Firebase identity and start list/chunk on link intent | Overlap auth, code and HTTP waits | Frontend |
| P1 | Lazy-load dialogs, cover tools and EPUB export | Less initial JS transfer, parse and evaluation | Frontend |
| P1 | Fetch reading history on tab activation; preserve errors | One fewer initial GET and truthful empty state | Frontend |
| P1 | Paginate owner list and batch tag hydration; consider a compact list DTO | Bounded payload, SQL queries and mounted rows | story-data + frontend |
| P2 | Patch cache after mutations; separate story and chain cache keys | Fewer repeat GETs and chain reads | Frontend |
| P2 | Shelf-shaped route fallback, cover priority from trace | Earlier orientation and steadier layout | Frontend |

Benchmark the current route before implementation and the candidate with the same seeded accounts: 0, 10 and 100 stories; cold signed-in refresh, link-intent navigation, warm return, chain delay/failure, and a writing-to-reading tab switch. Record first real title, first cover, LCP, CLS, main-thread long tasks, transferred JS/JSON/image bytes, `/v1/stories` latency and size, SQL statement count, and RPC requests/read calls. Test a chain switch and account switch to verify cache isolation and earnings freshness. Compare equivalent content on both builds, as in the existing stories-page benchmark.
