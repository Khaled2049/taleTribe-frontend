import type { ChatModelRunResult } from "@assistant-ui/react";
import {
  capabilitiesFor,
  emptyRunState,
  HELP_BOUNDARIES,
  HELP_PREAMBLE,
  type Capability,
} from "@novelsync/assistant-contracts";
import {
  toAssistantRunResult,
  type AssistantMessageMetadata,
} from "./assistantRunModel";

/** The plain-text form: what the copy action copies, and the a11y fallback. */
export function helpPlainText(
  capabilities: readonly Capability[],
  boundaries: readonly string[] = HELP_BOUNDARIES,
): string {
  const sections = capabilities.map((capability) =>
    [
      capability.title,
      capability.summary,
      capability.limits,
      `Try: ${capability.example}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [HELP_PREAMBLE, ...sections, boundaries.join("\n")].join("\n\n");
}

/**
 * The answer to `/help`, assembled in the browser.
 *
 * The metadata defaults come from `toAssistantRunResult(emptyRunState())` so
 * there is one definition of an assistant message's metadata shape. What is
 * deliberately *not* done is forging a `run.completed` event to feed it: no run
 * happened, so `runId` stays null and `modelCalls` stays 0 — which is what
 * suppresses the "N tokens · N credits" line. A reply that cost nothing must
 * not be presented as if it were billed.
 */
export function buildHelpRunResult({
  editsEnabled,
  researchEnabled = false,
}: {
  editsEnabled: boolean;
  researchEnabled?: boolean;
}): ChatModelRunResult {
  const capabilities = capabilitiesFor({ editsEnabled, researchEnabled });
  const skeleton = toAssistantRunResult(emptyRunState());
  const base = (skeleton.metadata?.custom?.novelsync ??
    {}) as AssistantMessageMetadata;
  const metadata: AssistantMessageMetadata = {
    ...base,
    kind: "local_help",
    finishReason: "stop",
    help: {
      preamble: HELP_PREAMBLE,
      boundaries: HELP_BOUNDARIES,
      capabilities,
    },
  };
  return {
    content: [
      {
        type: "text",
        text: helpPlainText(capabilities),
        status: { type: "complete" },
      },
    ],
    status: { type: "complete", reason: "stop" },
    metadata: { ...skeleton.metadata, custom: { novelsync: metadata } },
  };
}
