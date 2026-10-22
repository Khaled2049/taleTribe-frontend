import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayNote, isMcpStatus, nextMcpStatus, parseMcpReview } from "../src/domain/mcpAccess";

describe("nextMcpStatus", () => {
  it("grants a pending or previously revoked record", () => {
    assert.equal(nextMcpStatus("requested", "grant"), "granted");
    assert.equal(nextMcpStatus("revoked", "grant"), "granted");
    assert.equal(nextMcpStatus("granted", "grant"), null);
  });

  it("rejects only pending requests and revokes only granted access, both to revoked", () => {
    assert.equal(nextMcpStatus("requested", "reject"), "revoked");
    assert.equal(nextMcpStatus("granted", "reject"), null);
    assert.equal(nextMcpStatus("granted", "revoke"), "revoked");
    assert.equal(nextMcpStatus("requested", "revoke"), null);
    assert.equal(nextMcpStatus(undefined, "grant"), null);
  });
});

describe("parseMcpReview", () => {
  it("needs a uid and a known decision", () => {
    assert.deepEqual(parseMcpReview({ uid: "abc_1-2", decision: "grant" }), { uid: "abc_1-2", decision: "grant" });
    assert.equal(parseMcpReview({ uid: "abc", decision: "delete" }), null);
    assert.equal(parseMcpReview({ uid: "a/b", decision: "grant" }), null);
    assert.equal(parseMcpReview(null), null);
  });
});

describe("displayNote and isMcpStatus", () => {
  it("strips control characters and bounds the note", () => {
    assert.equal(displayNote("hi\nthere\u0007"), "hi there ");
    assert.equal(displayNote("x".repeat(600)).length, 500);
    assert.equal(displayNote(42), "");
  });

  it("knows the three statuses", () => {
    assert.ok(isMcpStatus("revoked"));
    assert.ok(!isMcpStatus("rejected"));
  });
});
