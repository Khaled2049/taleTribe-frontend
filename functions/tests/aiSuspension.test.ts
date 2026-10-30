import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_SUSPENSION_REASON,
  parseSuspensionChange,
  suspensionBlocks,
  toSuspension,
  type AiSuspension,
} from "../src/domain/aiSuspension";

const suspension = (scope: AiSuspension["scope"]): AiSuspension => ({
  scope,
  reason: null,
  suspendedBy: "admin",
  suspendedAt: null,
});

describe("parseSuspensionChange", () => {
  it("needs a scope to suspend and trims the reason", () => {
    assert.deepEqual(parseSuspensionChange({ uid: "u1", suspended: true, scope: "all", reason: "  spam  " }), {
      uid: "u1",
      suspended: true,
      scope: "all",
      reason: "spam",
    });
    assert.deepEqual(parseSuspensionChange({ uid: "u1", suspended: true, scope: "platform", reason: " " }), {
      uid: "u1",
      suspended: true,
      scope: "platform",
      reason: null,
    });
    assert.equal(parseSuspensionChange({ uid: "u1", suspended: true }), null);
    assert.equal(parseSuspensionChange({ uid: "u1", suspended: true, scope: "everything" }), null);
  });

  it("restores with only a uid", () => {
    assert.deepEqual(parseSuspensionChange({ uid: "u1", suspended: false, scope: "nonsense" }), {
      uid: "u1",
      suspended: false,
    });
  });

  it("refuses bad input", () => {
    assert.equal(parseSuspensionChange(null), null);
    assert.equal(parseSuspensionChange({ uid: "a/b", suspended: false }), null);
    assert.equal(parseSuspensionChange({ uid: "u1", suspended: "true", scope: "all" }), null);
    assert.equal(parseSuspensionChange({ uid: "u1", suspended: true, scope: "all", reason: 7 }), null);
    assert.equal(
      parseSuspensionChange({ uid: "u1", suspended: true, scope: "all", reason: "x".repeat(MAX_SUSPENSION_REASON + 1) }),
      null,
    );
  });
});

describe("suspensionBlocks", () => {
  it("lets everyone through when there is no suspension", () => {
    assert.equal(suspensionBlocks(null, false), false);
    assert.equal(suspensionBlocks(null, true), false);
  });

  it("platform scope stops platform AI but not the member's own key", () => {
    assert.equal(suspensionBlocks(suspension("platform"), false), true);
    assert.equal(suspensionBlocks(suspension("platform"), true), false);
  });

  it("all scope stops both", () => {
    assert.equal(suspensionBlocks(suspension("all"), false), true);
    assert.equal(suspensionBlocks(suspension("all"), true), true);
  });
});

describe("toSuspension", () => {
  it("reads a stored document and fails closed on an unknown scope", () => {
    assert.equal(toSuspension(undefined), null);
    const at = new Date("2026-10-22T10:00:00Z");
    assert.deepEqual(toSuspension({ scope: "platform", reason: "cost", suspendedBy: "a1", suspendedAt: { toDate: () => at } }), {
      scope: "platform",
      reason: "cost",
      suspendedBy: "a1",
      suspendedAt: at.toISOString(),
    });
    assert.equal(toSuspension({ scope: "weird" })?.scope, "all");
  });
});
