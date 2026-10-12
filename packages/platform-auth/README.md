# @novelsync/platform-auth

Call `initializePlatformAuth({ firebase, platform, emulators? })` once during app
bootstrap before identity hooks, token providers, route loaders, or Firebase
service subpaths execute. Importing the root or `/core` initializes nothing and
reads no Vite environment variables. Equivalent initialization is idempotent;
conflicting configuration throws.

`platform: "web"` retains Firebase `getAuth`. `platform: "mobile"` uses
`initializeAuth` with IndexedDB and browser-local persistence. Firebase and React
are peer dependencies supplied by the app. Native auth persistence still needs
Tauri webview validation; a browser build is not sufficient evidence.

`getAuthContext`, `getCurrentUid`, and `useAuthIdentity` consume the configured SDK.
Optional `/firestore` and `/storage` imports initialize those services after auth
configuration; `/firestore-core` and `/storage-core` are equivalent exports for
web compatibility adapters. Reader/mobile imports should use the root only.
Profile data belongs to story-data, not this package. Apps clear private query
caches on sign-out/account changes.

See `docs/shared-reader-packages.md` in the owning repository for artifact builds
and release instructions. Distribution is private; the license is unchanged.
