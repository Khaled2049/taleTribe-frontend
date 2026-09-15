import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  capabilitiesFor,
  HELP_BOUNDARIES,
} from "@novelsync/assistant-contracts";
import {
  buildHelpRunResult,
  helpPlainText,
} from "@/components/chat/localHelpResult";
import type { AssistantMessageMetadata } from "@/components/chat/assistantRunModel";

function metadataOf(result: ReturnType<typeof buildHelpRunResult>) {
  return result.metadata?.custom?.novelsync as AssistantMessageMetadata;
}

describe("local help result", () => {
  it("is free, and its metadata says so", () => {
    const result = buildHelpRunResult({ editsEnabled: true });
    const metadata = metadataOf(result);

    expect(metadata.kind).toBe("local_help");
    expect(metadata.runId).toBeNull();
    expect(metadata.provider).toBeNull();
    expect(metadata.failure).toBeNull();
    expect(metadata.notice).toBeNull();
    // The usage line renders only when modelCalls > 0, so a reply that cost
    // nothing must not carry a token or credit count.
    expect(metadata.usage.modelCalls).toBe(0);
    expect(metadata.usage.credits).toBe(0);
    expect(result.metadata?.steps).toBeUndefined();
  });

  it("keeps a text part so copy and assistive tech still reach the content", () => {
    const result = buildHelpRunResult({ editsEnabled: true });
    const text = result.content?.find((part) => part.type === "text");

    expect(text).toBeDefined();
    expect(text?.type === "text" && text.text).toContain(CAPABILITIES[0].title);
  });

  it("filters the catalog by the flags a run would actually use", () => {
    const withEdits = metadataOf(buildHelpRunResult({ editsEnabled: true }));
    const readOnly = metadataOf(buildHelpRunResult({ editsEnabled: false }));

    expect(withEdits.help?.capabilities).toEqual(
      capabilitiesFor({ editsEnabled: true }),
    );
    expect(readOnly.help?.capabilities.some((c) => c.gate === "edits")).toBe(
      false,
    );
    expect(
      withEdits.help?.capabilities.some((c) => c.gate === "research"),
    ).toBe(false);
  });

  it("renders every capability and both boundaries into the plain text", () => {
    const capabilities = capabilitiesFor({ editsEnabled: true });
    const text = helpPlainText(capabilities);

    for (const capability of capabilities) {
      expect(text).toContain(capability.title);
      expect(text).toContain(capability.example);
    }
    for (const boundary of HELP_BOUNDARIES) {
      expect(text).toContain(boundary);
    }
  });
});
