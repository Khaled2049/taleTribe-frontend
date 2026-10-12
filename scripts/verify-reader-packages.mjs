import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const consumer = mkdtempSync(path.join(tmpdir(), "taletribe-reader-consumer-"));
const names = [
  "story-data-client",
  "platform-auth",
  "reader-ui",
  "design-tokens",
];
const dependencies = {};
mkdirSync(path.join(consumer, "vendor"));
for (const name of names) {
  const manifest = JSON.parse(
    readFileSync(path.join(root, "packages", name, "package.json")),
  );
  const tarball = `novelsync-${name}-${manifest.version}.tgz`;
  cpSync(
    path.join(root, ".artifacts/reader-packages", tarball),
    path.join(consumer, "vendor", tarball),
  );
  dependencies[manifest.name] = `file:vendor/${tarball}`;
  for (const peer of Object.keys(manifest.peerDependencies ?? {}))
    dependencies[peer] = "";
}
for (const dependency of [
  "vite",
  "typescript",
  "tailwindcss",
  "postcss",
  "autoprefixer",
  "@types/react",
  "@types/react-dom",
])
  dependencies[dependency] = "";
// Pin consumer peers/tools to this checkout's tested versions. Package files
// themselves are installed from tarballs, with no workspace links or aliases.
for (const dependency of Object.keys(dependencies)) {
  if (!dependencies[dependency])
    dependencies[dependency] = JSON.parse(
      readFileSync(path.join(root, "node_modules", dependency, "package.json")),
    ).version;
}
dependencies.jsdom = "26.1.0";
cpSync(path.join(root, "scripts/fixtures/reader-package-consumer"), consumer, {
  recursive: true,
});
writeFileSync(
  path.join(consumer, "package.json"),
  JSON.stringify(
    {
      name: "reader-package-consumer",
      private: true,
      type: "module",
      dependencies,
    },
    null,
    2,
  ),
);
console.log(`Independent consumer: ${consumer}`);
const offline = process.env.READER_VERIFY_OFFLINE === "1" ? ["--offline"] : [];
execFileSync(
  "npm",
  [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--fetch-retries=0",
    "--fetch-timeout=20000",
    "--cache",
    path.join(root, ".artifacts/npm-cache"),
    ...offline,
  ],
  { cwd: consumer, stdio: "inherit" },
);
for (const name of names) {
  const installed = path.join(consumer, "node_modules/@novelsync", name);
  assert(
    !lstatSync(installed).isSymbolicLink(),
    `${name} must be a real installed artifact`,
  );
  assert(
    !existsSync(path.join(installed, "src")),
    `${name} must not expose source`,
  );
  function audit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) audit(file);
      else if (/\.(?:js|ts)$/.test(entry.name)) {
        const content = readFileSync(file, "utf8");
        assert(!/from\s+["']@\//.test(content), `${file}: app alias`);
        const source = ts.createSourceFile(
          file,
          content,
          ts.ScriptTarget.Latest,
        );
        function inspect(node) {
          if (ts.isPropertyAccessExpression(node))
            assert(
              node.getText(source) !== "import.meta.env",
              `${file}: implicit environment`,
            );
          ts.forEachChild(node, inspect);
        }
        inspect(source);
      }
    }
  }
  audit(path.join(installed, "dist"));
}
execFileSync(path.join(consumer, "node_modules/.bin/tsc"), ["--noEmit"], {
  cwd: consumer,
  stdio: "inherit",
});
execFileSync(process.execPath, ["smoke.mjs"], {
  cwd: consumer,
  stdio: "inherit",
});
execFileSync(path.join(consumer, "node_modules/.bin/vite"), ["build"], {
  cwd: consumer,
  stdio: "inherit",
});
const assets = path.join(consumer, "dist/assets");
const css = readdirSync(assets)
  .filter((file) => file.endsWith(".css"))
  .map((file) => readFileSync(path.join(assets, file), "utf8"))
  .join("\n");
for (const marker of [
  ".text-current",
  ".bg-ns-bg",
  "env(safe-area-inset-top)",
  "env(safe-area-inset-bottom)",
])
  assert(css.includes(marker), `Missing reader CSS: ${marker}`);
const javascript = readdirSync(assets)
  .filter((file) => file.endsWith(".js"))
  .map((file) => readFileSync(path.join(assets, file), "utf8"))
  .join("\n");
for (const marker of [
  "speechSynthesis",
  "kokoro",
  "CreateStory",
  "wagmi",
  "TipModal",
])
  assert(!javascript.includes(marker), `Unexpected web feature: ${marker}`);
mkdirSync(path.join(root, ".artifacts"), { recursive: true });
writeFileSync(
  path.join(root, ".artifacts/reader-package-verification.json"),
  JSON.stringify(
    {
      consumer,
      checkedAt: new Date().toISOString(),
      packages: names,
      sourceAliases: false,
      packageSymlinks: false,
      inputTarballsVendored: true,
      typecheck: "passed",
      nodeSmoke: "passed",
      profileAdapter: "passed",
      viteBuild: "passed",
      readerCss: "passed",
      webSpeechAndCreation: "excluded",
    },
    null,
    2,
  ),
);
console.log(
  "Packed consumer passed: declarations, bootstrap, queries, reader, Tailwind, and independent Vite build.",
);
