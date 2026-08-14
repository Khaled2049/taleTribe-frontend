import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Firestore security-rules tests.
 *
 * Separate from vitest.config.ts because these require a running Firestore
 * emulator on 127.0.0.1:8080:
 *
 *     firebase emulators:start --only firestore
 *     yarn test:rules
 *
 * They are slower and stateful (each test clears the emulator), so they stay
 * out of the default `yarn test` run rather than making it depend on external
 * state.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    // Rules tests share one emulator and clear it between cases, so they must
    // not run concurrently with each other.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
