# SEO

How public pages are made crawlable, and the rules that keep it working. The
app is still a client-rendered SPA; nothing here is a framework.

## How a public page is served

```
crawler / browser
  → Firebase Hosting
      /story/**  /profile/**  /stories  /stories/**  /sitemap.xml  /sitemaps/**
          → seoRender (Cloud Function, functions/src/endpoints/seoRender.ts)
              → story-data /v1/public/*   (anonymous reads)
              → Hosting /index.html       (the built shell, revalidated by ETag)
      everything else → /index.html (static)
```

`seoRender` returns the same SPA shell a browser would have got, with three
things filled in: the page's `<head>` tags, its JSON-LD, and a plain-HTML
snapshot of the content inside `#root`. React replaces the snapshot on boot.
Crawlers and link-preview bots that do not run JavaScript see real content;
everyone else sees the app, slightly sooner.

It also does the things a static shell cannot: a real **404** for a missing or
unpublished story (the shell alone is a soft 404), and a **301** from
`/story/<id>` or a stale slug to the canonical URL.

If story-data is unreachable the plain shell is sent uncached and the app
renders client-side as before. If the Function itself is down, the rewritten
routes are down — that is the cost of this design, and why the deploy health
check requests `/stories` and `/sitemap.xml`.

Responses are cached at Hosting's CDN for five minutes (`s-maxage=300`,
`max-age=0`); a Hosting deploy purges it.

## URLs

| Page | URL |
|---|---|
| Story | `/story/<slug>-<uuid>` |
| Chapter | `/story/<slug>-<uuid>/read/<chapterId>` |
| Author | `/profile/<uid>` |
| Genre | `/stories/genre/<genre>` |
| Tag | `/stories/tag/<tag>` (lower-case, spaces as hyphens) |

The slug is decoration: only the trailing UUID identifies a story, so renaming
one never breaks a link. Build links with `storyPath()` and friends from
`src/lib/seoPaths.ts`, never by hand.

**`src/lib/seoPaths.ts` and `functions/src/seo/paths.ts` are a KEEP IN SYNC
pair**, as are their genre lists. Functions deploys without the app's sources,
so the code is duplicated; both sides assert the same vectors
(`tests/seoPaths.test.ts`, `functions/tests/seo.test.ts`). If they drift, the
server 301s every link the app renders.

## Who owns which tag

- **`<head>` meta and canonical** — written by `seoRender` for the routes above,
  and by `SEOHead` (react-helmet-async) on every route. Tags in `index.html`
  and from `seoRender` carry `data-rh="true"` so Helmet adopts them instead of
  appending duplicates. A default tag added to `index.html` without that
  attribute will appear twice on every page.
- **JSON-LD for stories, chapters, profiles and listings** — `seoRender` only
  (`functions/src/seo/schema.ts`): `Book`, `Chapter`, `ProfilePage`,
  `CollectionPage`/`ItemList`, `BreadcrumbList`. The app does not emit its own
  for those pages, so there is one copy.
- **The canonical origin** — one value, `SITE_URL` (repository variable), fed to
  the build as `VITE_SITE_URL` and to Functions as `SITE_URL`. Never
  `window.location.origin`: the site also answers on `www` and `*.web.app`.

## What is indexed

| Indexed | Not indexed |
|---|---|
| Home, `/stories`, genre pages | Search results (`/stories?q=`) |
| Published stories and their chapters | Drafts and unpublished stories (404) |
| Profiles of members with a published story | Profiles of members with none |
| Tag pages with three or more stories | Thinner tag pages |
| Competitions list and detail, book clubs list, help, legal | Editor, dashboard, auth, guestbooks, book club rooms, MCP consent |

Private routes are excluded two ways: an `X-Robots-Tag: noindex` header in
`firebase.json`, which works without JavaScript, and `<SEOHead noindex />`.
`robots.txt` deliberately allows everything — a crawler blocked there never
sees a `noindex`. **A new private route needs a header entry in
`firebase.json`.**

## Sitemap

`/sitemap.xml` is an index of `/sitemaps/pages.xml` (static routes and genres),
`/sitemaps/stories.xml` and `/sitemaps/authors.xml`, built from story-data's
`GET /v1/public/sitemap`. A story-data outage answers 503 rather than an empty
file. `stories.xml` stops at 45,000 URLs and logs a warning; shard it before
the catalogue gets there.

`robots.txt` is emitted at build time by the `seo` plugin in `vite.config.ts`.

## Local development

Vite does not go through `seoRender`, so `yarn dev` shows only what `SEOHead`
sets. To see the server output, build the app and run the Hosting and Functions
emulators (`yarn build && yarn start:emulator`), then request
`http://127.0.0.1:5033/stories`.
