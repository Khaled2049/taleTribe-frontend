import { describe, expect, it } from "vitest";
import {
  doomCheckpoint,
  knownPageCount,
  pageQuip,
  parseFeedMode,
} from "../src/lib/feedPaging";

describe("parseFeedMode", () => {
  it("defaults to pages for anything but an explicit scroll", () => {
    expect(parseFeedMode(null)).toBe("pages");
    expect(parseFeedMode(undefined)).toBe("pages");
    expect(parseFeedMode("garbage")).toBe("pages");
    expect(parseFeedMode("pages")).toBe("pages");
    expect(parseFeedMode("scroll")).toBe("scroll");
  });
});

describe("knownPageCount", () => {
  it("offers one page past what is loaded only when more exist", () => {
    expect(knownPageCount(1, false)).toBe(1);
    expect(knownPageCount(1, true)).toBe(2);
    expect(knownPageCount(3, true)).toBe(4);
  });

  it("never reports zero pages before the first load", () => {
    expect(knownPageCount(0, false)).toBe(1);
  });
});

describe("pageQuip", () => {
  it("closes out the feed on the last page", () => {
    expect(pageQuip(1, true)).toMatch(/finite/);
    expect(pageQuip(5, true)).toMatch(/end/);
  });

  it("escalates with depth", () => {
    expect(pageQuip(2, false)).toMatch(/reasonable/);
    expect(pageQuip(9, false)).toMatch(/thumb/);
    expect(pageQuip(40, false)).toMatch(/book/);
  });
});

describe("doomCheckpoint", () => {
  it("fires only on multiples of the interval", () => {
    expect(doomCheckpoint(0)).toBeNull();
    expect(doomCheckpoint(29)).toBeNull();
    expect(doomCheckpoint(30)).toMatch(/30 posts/);
    expect(doomCheckpoint(31)).toBeNull();
  });

  it("keeps the last line for every lap past the scripted ones", () => {
    expect(doomCheckpoint(90)).toMatch(/doom part/);
    expect(doomCheckpoint(300)).toMatch(/300 posts\. This is the doom part/);
  });
});
