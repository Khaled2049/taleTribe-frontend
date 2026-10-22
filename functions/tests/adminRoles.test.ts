import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_ROLE_LOOKUP, parseRoleChange, parseRoleLookup, withAdminClaim } from "../src/domain/adminRoles";

describe("parseRoleChange", () => {
  it("needs a uid and a boolean", () => {
    assert.deepEqual(parseRoleChange({ uid: "u1", admin: true }), { uid: "u1", admin: true });
    assert.equal(parseRoleChange({ uid: "u1", admin: "true" }), null);
    assert.equal(parseRoleChange({ admin: false }), null);
    assert.equal(parseRoleChange({ uid: "x".repeat(129), admin: true }), null);
    assert.equal(parseRoleChange(null), null);
  });
});

describe("parseRoleLookup", () => {
  it("dedupes and bounds the batch", () => {
    assert.deepEqual(parseRoleLookup({ uids: ["a", "b", "a"] }), ["a", "b"]);
    assert.deepEqual(parseRoleLookup({ uids: [] }), []);
    assert.equal(parseRoleLookup({ uids: Array.from({ length: MAX_ROLE_LOOKUP + 1 }, (_, i) => `u${i}`) }), null);
    assert.equal(parseRoleLookup({ uids: ["a", 7] }), null);
    assert.equal(parseRoleLookup({}), null);
  });
});

describe("withAdminClaim", () => {
  it("adds or removes only the admin claim", () => {
    assert.deepEqual(withAdminClaim({ beta: true }, true), { beta: true, admin: true });
    assert.deepEqual(withAdminClaim({ beta: true, admin: true }, false), { beta: true });
    assert.deepEqual(withAdminClaim(undefined, false), {});
  });
});
