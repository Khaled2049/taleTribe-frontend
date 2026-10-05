import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

// KEEP IN SYNC with DEFAULT_SITE_URL in src/config/seo.ts and siteUrl() in
// functions/src/seo/site.ts.
const DEFAULT_SITE_URL = "https://thetaletribe.com";

/**
 * Writes the canonical origin into the two places that cannot read it at
 * runtime: index.html's default social image, and robots.txt, whose Sitemap
 * line must be absolute. robots.txt allows everything on purpose — private
 * routes are kept out of the index by X-Robots-Tag (firebase.json) and a
 * noindex meta tag, and a crawler blocked here would never see either.
 */
function seo(siteUrl: string): Plugin {
  return {
    name: "taletribe-seo",
    transformIndexHtml: (html) => html.replace(/__SITE_URL__/g, siteUrl),
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    seo(
      (
        loadEnv(mode, process.cwd(), "VITE_").VITE_SITE_URL || DEFAULT_SITE_URL
      ).replace(/\/+$/, ""),
    ),
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
      "@novelsync/platform-auth/firestore": path.resolve(
        __dirname,
        "./packages/platform-auth/src/firestore.ts",
      ),
      "@novelsync/platform-auth/storage": path.resolve(
        __dirname,
        "./packages/platform-auth/src/storage.ts",
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
      "/assistant-run": {
        target: "http://127.0.0.1:5002",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/assistant-run/, ""),
      },
      "/story-data": {
        target: "http://localhost:8084",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/story-data/, ""),
      },
    },
  },
}));
