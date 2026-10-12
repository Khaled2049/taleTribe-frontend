import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { rmSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [
  "story-data-client",
  "platform-auth",
  "reader-ui",
  "design-tokens",
]) {
  console.log(`Building @novelsync/${name}`);
  rmSync(path.join(root, "packages", name, "dist"), {
    recursive: true,
    force: true,
  });
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      `packages/${name}/tsconfig.build.json`,
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (name === "design-tokens") {
    const { copyFileSync } = await import("node:fs");
    copyFileSync(
      path.join(root, "packages/design-tokens/src/styles.css"),
      path.join(root, "packages/design-tokens/dist/styles.css"),
    );
  }
}
