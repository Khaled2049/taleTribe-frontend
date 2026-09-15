import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixtureDir = path.join(packageRoot, "fixtures");
const manifest = JSON.parse(
  await readFile(path.join(fixtureDir, "MANIFEST.json"), "utf8"),
);
const fixtureNames = (await readdir(fixtureDir))
  .filter((name) => name.endsWith(".json") && name !== "MANIFEST.json")
  .sort();
const manifestNames = Object.keys(manifest).sort();

if (JSON.stringify(fixtureNames) !== JSON.stringify(manifestNames)) {
  console.error("assistant fixture set differs from MANIFEST.json");
  process.exit(1);
}

for (const name of fixtureNames) {
  const bytes = await readFile(path.join(fixtureDir, name));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== manifest[name]) {
    console.error(`assistant fixture hash mismatch: ${name}`);
    process.exit(1);
  }
}

console.log("assistant fixture manifest is current");
