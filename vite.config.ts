import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "analyze" &&
      visualizer({
        open: true,
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@novelsync/story-data-client": path.resolve(
        __dirname,
        "./packages/story-data-client/src/index.ts",
      ),
      "@novelsync/platform-auth": path.resolve(
        __dirname,
        "./packages/platform-auth/src/index.ts",
      ),
      "@novelsync/assistant-contracts": path.resolve(
        __dirname,
        "./packages/assistant-contracts/src/index.ts",
      ),
      buffer: "buffer/",
    },
  },
  optimizeDeps: {
    include: ["buffer"],
  },
  server: {
    proxy: {
      "/assistant-spike": {
        target: "http://127.0.0.1:5002",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/assistant-spike/, ""),
      },
      "/story-data": {
        target: "http://localhost:8084",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/story-data/, ""),
      },
    },
  },
}));
