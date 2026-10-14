import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Deliberately separate from vite.config.ts.
 *
 * Vitest ships its own (much newer) copy of vite, so importing `defineConfig` from
 * `vitest/config` into the app config makes TypeScript compare that vite's `Plugin`
 * type against the app's vite 5 `Plugin` — an "excessive stack depth" error. Keeping
 * the test config here means no plugin types are ever compared across the two.
 *
 * Vitest prefers this file over vite.config.ts, so `yarn test` picks it up
 * automatically; `yarn build` never loads it.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: /^@novelsync\/story\-data\-client$/,
        replacement: path.resolve(
          __dirname,
          "./packages/story-data-client/src/index.ts",
        ),
      },
      {
        find: /^@novelsync\/platform\-auth\/firestore$/,
        replacement: path.resolve(__dirname, "./src/platform/firestore.ts"),
      },
      {
        find: /^@novelsync\/platform\-auth\/storage$/,
        replacement: path.resolve(__dirname, "./src/platform/storage.ts"),
      },
      {
        find: /^@novelsync\/platform\-auth$/,
        replacement: path.resolve(__dirname, "./src/platform/auth.ts"),
      },
      {
        find: /^@novelsync\/assistant\-contracts$/,
        replacement: path.resolve(
          __dirname,
          "./packages/assistant-contracts/src/index.ts",
        ),
      },
    ],
  },
  test: {
    // Unit tests only — browser/E2E coverage lives in cypress/.
    // They sit outside src/ so the app build doesn't pull in functions/ sources.
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // tests/rules/ needs a running Firestore emulator, so it is excluded here
    // and run by `yarn test:rules` (vitest.rules.config.ts). A suite that
    // silently passes when its dependency is absent is worse than no suite.
    exclude: ["tests/rules/**", "node_modules/**", "dist/**"],
  },
});
