# Shared reader packages

Package source stays in this repository. The website uses workspace packages;
`taleTribe-reader-mobile` consumes pinned built artifacts. Desktop does not need
to adopt them. The initial artifact set is version **0.1.0**:

| Package                        | API and ownership                                           |
| ------------------------------ | ----------------------------------------------------------- |
| `@novelsync/story-data-client` | Injected HTTP config, repositories, DTOs, errors            |
| `@novelsync/platform-auth`     | Explicit Firebase bootstrap and identity only               |
| `@novelsync/reader-ui`         | Reader, discovery/detail, shelf list, query hooks, adapters |
| `@novelsync/design-tokens`     | Shared CSS and Tailwind preset; app-owned fonts             |

## Development and checks

Use Node 22 and Yarn 1. `yarn install --frozen-lockfile`, then `yarn dev`,
`yarn build`, `yarn typecheck`, or `yarn test`. These commands build package
artifacts first. After changing package source while Vite is running, run
`yarn packages:build` again; package compilation is not a background watcher.

`yarn packages:pack` writes four tarballs to `.artifacts/reader-packages/`.
`yarn packages:verify` installs them in a fresh temporary consumer using npm,
checks declarations and absence of source aliases/package symlinks, exercises
guest reader/query/bootstrap contracts, and builds independent Vite/Tailwind
output. It also checks reader styles and exclusion of web speech, wallet, and
creation code. It requires registry access for declared dependencies; caches
are under `.artifacts/npm-cache/`. Set `READER_VERIFY_OFFLINE=1` only after caching
dependencies. Its consumer directory and verification JSON remain available for
inspection. PR CI runs this check. It uses placeholder configuration and mocked
HTTP responses; it does not modify the shared emulator stack.

## Consumer bootstrap

Install all four tarballs in the same package-manager operation so the reader's
pinned story-data dependency resolves to the supplied artifact, then commit the
consumer lockfile. Copy artifacts inside the mobile repo (for example `vendor/`)
when using local releases. A normal checkout/build must not reference frontend
directories, workspace links, or frontend TS aliases.

```ts
import {
  initializePlatformAuth,
  getAuthContext,
  getCurrentUid,
} from "@novelsync/platform-auth";
import { configureStoryData } from "@novelsync/story-data-client";

initializePlatformAuth({ firebase: appFirebaseConfig, platform: "mobile" });
configureStoryData({
  baseUrl: appStoryDataUrl,
  getAuthContext,
  getUid: getCurrentUid,
});
// Only now construct the router/loaders and render identity consumers.
```

The app owns the `QueryClient`, router, Firebase config, emulator addresses,
unsupported website-route fallback and external-link opener. Render shared views
under query, reader, and router contexts. Supply `ReaderProvider` identity,
viewer, preferences, dictionary and highlight adapters. The mobile viewer can use
`useReaderProfile(identity)`: `/profiles/me` and follow APIs supply the required
username, first name, photo and follow graph. When a profile request fails or
returns no profile, identity/name defaults keep reading available; follow actions
still report API errors and profile creation is not introduced here. Clear private
query caches on account changes/sign-out. Keep the existing reading-history query
keys and progress semantics.

The web provider wraps existing legacy auth/profile hydration, SEO, discovery
creation UI, recommendation Functions gateway, and optional wallet/speech features.
These integrations stay in `src/`, outside reader artifacts. Mobile supplies its
own recommendation gateway adapter if enabled; never bypass its existing trust
boundary. Omit `readAloud` to disable speech. An injected read-aloud hook must stay
fixed over a mounted provider; remount if changing implementation.

Use the design Tailwind preset and scan the installed reader `dist/**/*.js`.
Import shared CSS before app CSS. Font bundles and web editor CSS are app-owned.
The independent consumer fixture under `scripts/fixtures/reader-package-consumer`
provides a minimal compiling bootstrap example, not a replacement mobile shell.

## Release and upgrades

For this extraction, distribute **private, versioned tarball artifacts**. This
avoids requiring a registry/account decision before independent app work. No
packages are published or given a new license. Build, test, lint, pack, and verify
the complete set before attaching tarballs to a private tagged release (or checking
them into mobile `vendor/` for local development). Record artifact checksums with
`shasum -a 256 .artifacts/reader-packages/*.tgz`.

Keep the four initial versions aligned and update the reader's exact story-data
dependency whenever its contract changes. Commit source/manifests/lockfile together;
release all changed packages before a mobile upgrade. Pin consumer versions and
commit its lockfile; upgrades are explicit consumer changes. Treat incompatible
contract changes as a new major version and coordinate both clients. Retain the
last verified artifact set for rollback.

Chunk 4 upgrades only `@novelsync/reader-ui` to **0.1.1**; the other packages
remain **0.1.0** because their contracts are unchanged. Reader popovers now stay
inside the visual viewport when notes grow or the keyboard opens. The mobile
manifest, lockfile, vendored tarball, source commit and checksum were updated
together, and the independent mobile install/build check passed. Retain the
0.1.0 reader artifact for rollback.

A configured private npm-compatible registry can replace artifact distribution
later. Use a CI secret for its token and app-owned `.npmrc` configuration; never
commit credentials. Do not publish to the public npm registry by default. Chunk 3
builds the mobile app; native auth persistence, bundled origins/CSP, and end-to-end
mobile behavior remain later acceptance checks.
