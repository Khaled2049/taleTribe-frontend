import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const schemaPath = path.join(packageRoot, "schema/v1.json");
const outputPath = path.join(packageRoot, "src/generated/protocol.ts");
const check = process.argv.includes("--check");

const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const options = {
  bannerComment: "// Generated from schema/v1.json. Do not edit by hand.\n",
  format: false,
  unknownAny: false,
};

const runRequest = await compile(
  schema.definitions.RunRequest,
  "RunRequest",
  options,
);
const assistantEvent = await compile(
  schema.definitions.AssistantEvent,
  "AssistantEvent",
  { ...options, bannerComment: "" },
);
// Writer-facing help copy rather than a validated wire type, so it is emitted
// as a frozen constant instead of being compiled from JSON Schema. The gate
// mirrors the agents run loop; a consumer filters on it rather than assuming
// every listed capability is reachable.
const capabilityType = [
  "",
  'export type CapabilityGate = "always" | "edits" | "research";',
  "export type Capability = {",
  "  readonly id: string;",
  "  readonly tools: readonly string[];",
  "  readonly gate: CapabilityGate;",
  "  readonly title: string;",
  "  readonly summary: string;",
  "  readonly example: string;",
  "  readonly limits?: string;",
  "};",
].join("\n");
const metadata = [
  "",
  `export const ASSISTANT_PROTOCOL_VERSION = ${JSON.stringify(schema.protocolVersion)} as const;`,
  `export const ERROR_CODES = ${JSON.stringify(schema.errorCodes)} as const;`,
  `export const TERMINAL_EVENT_TYPES = ${JSON.stringify(schema.terminalEventTypes)} as const;`,
  `export const APPROVAL_REQUIRED_TOOLS = ${JSON.stringify(schema.approvalRequiredTools)} as const;`,
  `export const LIMITS = ${JSON.stringify(schema.limits, null, 2)} as const;`,
  capabilityType,
  `export const HELP_PREAMBLE = ${JSON.stringify(schema.capabilities.preamble)} as const;`,
  `export const HELP_BOUNDARIES: readonly string[] = ${JSON.stringify(schema.capabilities.boundaries, null, 2)};`,
  `export const CAPABILITIES: readonly Capability[] = ${JSON.stringify(schema.capabilities.items, null, 2)};`,
  "",
].join("\n");
const indent = (source) =>
  source
    .trim()
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
const generated = [
  "// Generated from schema/v1.json. Do not edit by hand.",
  "",
  "export namespace RunContract {",
  indent(runRequest.replace(options.bannerComment, "")),
  "}",
  "export type RunRequest = RunContract.RunRequest;",
  "",
  "export namespace EventContract {",
  indent(assistantEvent),
  "}",
  "export type AssistantEvent = EventContract.AssistantEvent;",
  metadata,
]
  .join("\n")
  .split("\n")
  .map((line) => line.trimEnd())
  .join("\n");

if (check) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== generated) {
    console.error(
      "assistant generated types are stale; run yarn assistant:contracts:generate",
    );
    process.exit(1);
  }
  console.log("assistant generated types are current");
} else {
  await writeFile(outputPath, generated);
  console.log(`generated ${path.relative(packageRoot, outputPath)}`);
}
