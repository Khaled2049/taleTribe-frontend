# @novelsync/reader-ui

Shared discovery, story details, chapter reader, Continue Reading, query hooks,
prefetch functions, formatting, route helpers, and reader types. ESM JavaScript
and declarations are shipped in `dist/`; no frontend source checkout is needed.

Render within the consuming app's React Query, `ReaderProvider`, and React Router
contexts. Supply identity, viewer/profile actions, preferences, highlights,
dictionary lookup, and app name. Metadata, discovery header, author support,
recommendations, and read-aloud are optional adapters. The default header has no
writing entry point; default read-aloud is disabled and imports no speech engine.
Keep an injected read-aloud hook implementation fixed for the provider lifetime.

`useReaderProfile(identity)` supplies a story-data profile/follow adapter without
Firestore hydration. It falls back to identity display name and photo (or
`Signed in`) when profile data is missing; it does not create a profile. Signed-out
reading does not require a profile. Apps own sign-out/query-cache clearing.

Prefetch functions require the app's `QueryClient` explicitly. Public route shapes
are compatible with the website; apps implement route loaders, sign-in redirects,
unsupported-route website fallbacks, and external links in their router/shell.
Preferences and highlights are persistence adapters so apps choose their storage.

Import design CSS and use the design package Tailwind preset. Include
`./node_modules/@novelsync/reader-ui/dist/**/*.js` in Tailwind content to generate
shared classes. Deep imports preserve the source layout (without extensions).
React, React DOM, Router, and React Query are consumer peers.

See the owning repository's `docs/shared-reader-packages.md` for build, verification,
artifact release, bootstrap, and upgrade instructions. Distribution is private;
the repository license remains unchanged.
