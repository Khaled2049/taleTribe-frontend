import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isInviteStatus, nextInviteStatus, parseReviewRequest } from "../src/domain/inviteReview";

describe("nextInviteStatus", () => {
  it("approves a pending or previously rejected request", () => {
    assert.equal(nextInviteStatus("pending", "approve"), "approved");
    assert.equal(nextInviteStatus("rejected", "approve"), "approved");
  });

  it("never re-approves an invite whose email went out or was used", () => {
    for (const status of ["approved", "sent", "completed", undefined, "bogus"]) {
      assert.equal(nextInviteStatus(status, "approve"), null, String(status));
    }
  });

  it("rejects only a pending request", () => {
    assert.equal(nextInviteStatus("pending", "reject"), "rejected");
    for (const status of ["approved", "sent", "completed", "rejected"]) {
      assert.equal(nextInviteStatus(status, "reject"), null, status);
    }
  });
});

describe("parseReviewRequest", () => {
  it("accepts an email and a known decision", () => {
    assert.deepEqual(parseReviewRequest({ email: "a@b.co", decision: "approve" }), {
      email: "a@b.co",
      decision: "approve",
    });
  });

  it("refuses unknown decisions, missing emails and path-like ids", () => {
    assert.equal(parseReviewRequest({ email: "a@b.co", decision: "delete" }), null);
    assert.equal(parseReviewRequest({ decision: "approve" }), null);
    assert.equal(parseReviewRequest({ email: "x/y", decision: "approve" }), null);
    assert.equal(parseReviewRequest(null), null);
  });
});

describe("isInviteStatus", () => {
  it("knows the five statuses and nothing else", () => {
    assert.ok(isInviteStatus("sent"));
    assert.ok(!isInviteStatus("all"));
  });
});
