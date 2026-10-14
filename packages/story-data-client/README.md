# @novelsync/story-data-client

ESM HTTP repositories, DTOs, mappers, and error helpers for story-data. Call
`configureStoryData({ baseUrl, getAuthContext, getUid })` during app bootstrap
before repositories are used. All configuration is injected; this package has no
Firebase, Vite environment, or app-source dependency. Never provide database
credentials to a browser app.

The root and deep imports ship JavaScript and TypeScript declarations in `dist/`.
Existing request DTOs, token provider calls, errors, and `If-Match` handling are
preserved. See `docs/shared-reader-packages.md` in the owning repository for
verified artifact releases. Distribution is private; the license is unchanged.
