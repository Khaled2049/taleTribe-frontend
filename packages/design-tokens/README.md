# @novelsync/design-tokens

Inkwell tokens, shared CSS, and the Tailwind 3 preset used by reading features.
Import `@novelsync/design-tokens/styles.css`; add the default export of
`@novelsync/design-tokens/tailwind` to `presets`. Include installed reader package
JavaScript in Tailwind `content`. Fonts remain app-owned. Editor-specific CSS is
kept in the website, outside this package. Tailwind is a consumer peer.

See the owning repository's `docs/shared-reader-packages.md` for artifact release
instructions. Distribution is private; the license is unchanged.
