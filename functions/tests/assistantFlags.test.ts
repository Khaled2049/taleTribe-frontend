import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assistantFlags } from "../src/domain/assistantFlags";

test("new capabilities default off; legacy remains on", () => {
  assert.deepEqual(assistantFlags({}), {
    api: false,
    edits: false,
    research: false,
    legacy: true,
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
test("legacy can be disabled independently", () => {
  assert.equal(
    assistantFlags({ ASSISTANT_LEGACY_FALLBACK_ENABLED: "false" }).legacy,
    false,
  );
});
