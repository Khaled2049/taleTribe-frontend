/**
 * What the assistant can do, in the writer's words.
 *
 * Generated from `assistant/help.py` in taleTribe-agents via `schema/v1.json`,
 * so the list cannot drift from the tool registry it describes — a tool added
 * there without help copy fails that repository's tests before it reaches here.
 *
 * Nothing in this module is a wire type. It exists so the browser can answer
 * "what can you do?" without spending a model call on a question whose answer
 * is already known, and without risking a confident description of a tool the
 * run loop would never offer.
 */
import {
  CAPABILITIES,
  HELP_BOUNDARIES,
  HELP_PREAMBLE,
  type Capability,
  type CapabilityGate,
} from "./generated/protocol";

export {
  CAPABILITIES,
  HELP_BOUNDARIES,
  HELP_PREAMBLE,
  type Capability,
  type CapabilityGate,
};

export type CapabilityFlags = {
  editsEnabled: boolean;
  /**
   * Defaults to false to match the agent, which passes `research_enabled=False`
   * unconditionally. Listing web research while that holds would be a promise
   * the run loop cannot keep.
   */
  researchEnabled?: boolean;
};

/** The capabilities a run would actually offer under these flags, in order. */
export function capabilitiesFor(flags: CapabilityFlags): readonly Capability[] {
  const enabled: Record<CapabilityGate, boolean> = {
    always: true,
    edits: flags.editsEnabled,
    research: flags.researchEnabled ?? false,
  };
  return CAPABILITIES.filter((capability) => enabled[capability.gate]);
}
