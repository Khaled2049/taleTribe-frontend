import { describe, expect, it } from "vitest";
import { isOwnStorageImage } from "../src/routes/Admin/ownImages";

const bucket = "story-6f89f.appspot.com";

describe("isOwnStorageImage", () => {
  it("allows images in the project's own bucket", () => {
    expect(
      isOwnStorageImage(
        `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/a.png?alt=media`,
        bucket,
      ),
    ).toBe(true);
    expect(
      isOwnStorageImage(
        `https://storage.googleapis.com/${bucket}/a.png`,
        bucket,
      ),
    ).toBe(true);
  });

  it("refuses another bucket on the same Google hosts", () => {
    expect(
      isOwnStorageImage(
        "https://firebasestorage.googleapis.com/v0/b/attacker.appspot.com/o/a.png",
        bucket,
      ),
    ).toBe(false);
    expect(
      isOwnStorageImage(
        `https://storage.googleapis.com/${bucket}-evil/a.png`,
        bucket,
      ),
    ).toBe(false);
  });

  it("refuses other hosts, plain http, malformed URLs and a missing bucket", () => {
    expect(
      isOwnStorageImage(`https://evil.example/${bucket}/a.png`, bucket),
    ).toBe(false);
    expect(
      isOwnStorageImage(
        `http://storage.googleapis.com/${bucket}/a.png`,
        bucket,
      ),
    ).toBe(false);
    expect(isOwnStorageImage("not a url", bucket)).toBe(false);
    expect(
      isOwnStorageImage(
        `https://storage.googleapis.com/${bucket}/a.png`,
        undefined,
      ),
    ).toBe(false);
  });
});
