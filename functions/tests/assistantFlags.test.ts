import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assistantFlags } from "../src/domain/assistantFlags";

test("every capability defaults off", () => {
  assert.deepEqual(assistantFlags({}), {
    api: false,
    edits: false,
    research: false,
  });
});
test("client flags cannot enable server capabilities", () => {
  assert.equal(
    assistantFlags({ VITE_ASSISTANT_UI_ENABLED: "true" }).api,
    false,
  );
  assert.equal(
    assistantFlags({ ASSISTANT_EDIT_PROPOSALS_ENABLED: "true" }).edits,
    false,
  );
});
test("edits and research cannot outlive the api flag", () => {
  // There is no legacy chat to fall back to now, so a half-enabled assistant
  // must not offer capabilities the run endpoint itself will refuse.
  const flags = assistantFlags({
    ASSISTANT_EDIT_PROPOSALS_ENABLED: "true",
    ASSISTANT_RESEARCH_ENABLED: "true",
  });
  assert.equal(flags.edits, false);
  assert.equal(flags.research, false);
});
test("the enabled api offers edits by default and keeps an explicit kill switch", () => {
  assert.equal(assistantFlags({ ASSISTANT_API_ENABLED: "true" }).edits, true);
  assert.equal(
    assistantFlags({
      ASSISTANT_API_ENABLED: "true",
      ASSISTANT_EDIT_PROPOSALS_ENABLED: "false",
    }).edits,
    false,
  );
});
