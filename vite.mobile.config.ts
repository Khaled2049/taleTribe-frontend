import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type UserConfigFnObject } from "vite";
import webConfig from "./vite.config";

// Set by `tauri ios dev` when the app runs on a physical device, which reaches
// the dev server over the LAN rather than on localhost.
const devHost = process.env.TAURI_DEV_HOST;

/**
 * The reader-only mobile app (Tauri). A second entry over the same `src/`, so
 * aliases and the dev proxy come from the web config rather than a fifth copy.
 */
export default defineConfig(async (env) => {
  const web = await (webConfig as UserConfigFnObject)(env);
  const vars = loadEnv(env.mode, process.cwd(), "VITE_");

  // A bundled app has no host to proxy `/story-data` through, so a relative
  // fallback would fail every request on the device.
  if (
    env.command === "build" &&
    env.mode === "production" &&
    !/^https:\/\//.test(vars.VITE_STORY_DATA_URL ?? "")
  ) {
    throw new Error(
      "The mobile build needs an absolute https VITE_STORY_DATA_URL.",
    );
  }

  return {
    plugins: [react()],
    resolve: web.resolve,
    optimizeDeps: web.optimizeDeps,
    define: {
      "import.meta.env.VITE_PLATFORM": JSON.stringify("mobile"),
    },
    clearScreen: false,
    server: {
      port: 5174,
      strictPort: true,
      host: devHost || false,
      hmr: devHost ? { protocol: "ws", host: devHost, port: 5175 } : undefined,
      proxy: web.server?.proxy,
      watch: { ignored: ["**/src-tauri/**"] },
    },
    build: {
      outDir: "dist-mobile",
      emptyOutDir: true,
      rollupOptions: { input: path.resolve(__dirname, "mobile.html") },
    },
  };
});
