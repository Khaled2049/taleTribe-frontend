import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".artifacts/reader-packages");
mkdirSync(output, { recursive: true });
for (const name of [
  "story-data-client",
  "platform-auth",
  "reader-ui",
  "design-tokens",
]) {
  execFileSync(
    "npm",
    [
      "pack",
      "--ignore-scripts",
      "--cache",
      path.join(root, ".artifacts/npm-cache"),
      "--pack-destination",
      output,
      "--quiet",
    ],
    { cwd: path.join(root, "packages", name), stdio: "inherit" },
  );
}
