import { describe, expect, it } from "vitest";
import {
  ZERO,
  addMinor,
  cmpMinor,
  formatMinorUnits,
  formatTokenAmount,
  gteMinor,
  isMinorUnits,
  isPositive,
  isZero,
  makeTokenAmount,
  parseTokenInput,
  subMinor,
  toMinorUnits,
} from "../src/lib/money";
import { TALE_DECIMALS, type MinorUnits } from "../src/types/IToken";

const m = (value: string) => value as MinorUnits;
const ONE_TALE = m("1000000000000000000");

describe("isMinorUnits", () => {
  it("accepts canonical non-negative integer strings", () => {
    expect(isMinorUnits("0")).toBe(true);
    expect(isMinorUnits("1")).toBe(true);
    expect(isMinorUnits("1000000000000000000")).toBe(true);
  });

  it("rejects everything that is not a canonical integer string", () => {
    // Exponent notation — what Number#toString produces for large values, and
    // the most likely way a bad amount would actually reach the ledger.
    expect(isMinorUnits("1e18")).toBe(false);
    expect(isMinorUnits("0.5")).toBe(false);
    expect(isMinorUnits("1.0")).toBe(false);
    expect(isMinorUnits("-1")).toBe(false);
    expect(isMinorUnits(" 1")).toBe(false);
    expect(isMinorUnits("1 ")).toBe(false);
    expect(isMinorUnits("01")).toBe(false);
    expect(isMinorUnits("")).toBe(false);
    expect(isMinorUnits("0x1")).toBe(false);
    expect(isMinorUnits("+1")).toBe(false);
    expect(isMinorUnits("abc")).toBe(false);
  });

  it("rejects non-strings, including numbers that look right", () => {
    expect(isMinorUnits(1)).toBe(false);
    expect(isMinorUnits(null)).toBe(false);
    expect(isMinorUnits(undefined)).toBe(false);
    expect(isMinorUnits(1n)).toBe(false);
  });

  it("rejects values wider than uint256", () => {
    expect(isMinorUnits("9".repeat(78))).toBe(true);
    expect(isMinorUnits("9".repeat(79))).toBe(false);
  });
});

describe("arithmetic", () => {
  it("is exact far beyond Number.MAX_SAFE_INTEGER", () => {
    // The entire reason amounts are strings: as floats these two are equal.
    const a = m("9007199254740993"); // 2^53 + 1
    const b = m("9007199254740992"); // 2^53
    expect(cmpMinor(a, b)).toBe(1);
    expect(subMinor(a, b)).toBe("1");

    // One wei short of a whole token must not round up.
    const almost = m("999999999999999999");
    expect(addMinor(almost, m("1"))).toBe("1000000000000000000");
    expect(cmpMinor(almost, ONE_TALE)).toBe(-1);
  });

  it("adds and subtracts without precision loss at scale", () => {
    const pool = m("1000000000000000000000"); // 1,000 TALE
    expect(subMinor(pool, ONE_TALE)).toBe("999000000000000000000");
    expect(addMinor(pool, ONE_TALE)).toBe("1001000000000000000000");
  });

  it("throws on underflow rather than going negative", () => {
    expect(() => subMinor(m("1"), m("2"))).toThrow(/insufficient/i);
    expect(() => subMinor(ZERO, m("1"))).toThrow();
  });

  it("throws when constructing a negative amount", () => {
    expect(() => toMinorUnits(-1n)).toThrow(/negative/i);
    expect(toMinorUnits(0n)).toBe("0");
  });

  it("compares without falling back to string ordering", () => {
    // Lexicographically "9" > "10", which is exactly the bug cmpMinor prevents.
    expect(cmpMinor(m("9"), m("10"))).toBe(-1);
    expect(gteMinor(m("10"), m("9"))).toBe(true);
    expect(cmpMinor(m("10"), m("10"))).toBe(0);
  });

  it("reports zero and positive correctly", () => {
    expect(isZero(ZERO)).toBe(true);
    expect(isZero(m("1"))).toBe(false);
    expect(isPositive(ZERO)).toBe(false);
    expect(isPositive(m("1"))).toBe(true);
  });
});

describe("formatting", () => {
  it("trims trailing zeros in the fraction", () => {
    expect(formatMinorUnits(ONE_TALE)).toBe("1");
    expect(formatMinorUnits(m("1500000000000000000"))).toBe("1.5");
    expect(formatMinorUnits(ZERO)).toBe("0");
  });

  it("keeps sub-wei-scale precision visible", () => {
    expect(formatMinorUnits(m("1"))).toBe("0.000000000000000001");
  });

  it("groups thousands and appends the symbol", () => {
    expect(formatTokenAmount(makeTokenAmount(m("1000000000000000000000")))).toBe(
      "1,000 TALE",
    );
    expect(formatTokenAmount(makeTokenAmount(ONE_TALE))).toBe("1 TALE");
  });
});

describe("parseTokenInput", () => {
  it("round-trips through format", () => {
    expect(parseTokenInput("1")).toBe(ONE_TALE.toString());
    expect(formatMinorUnits(parseTokenInput("1.5"))).toBe("1.5");
    expect(formatMinorUnits(parseTokenInput("1000"))).toBe("1000");
  });

  it("produces canonical minor units", () => {
    expect(isMinorUnits(parseTokenInput("25"))).toBe(true);
    expect(parseTokenInput("0")).toBe("0");
  });

  it("respects the decimals argument", () => {
    expect(parseTokenInput("1", 6)).toBe("1000000");
    expect(parseTokenInput("1", TALE_DECIMALS)).toBe(ONE_TALE.toString());
  });

  it("rejects malformed input", () => {
    expect(() => parseTokenInput("")).toThrow(/enter an amount/i);
    expect(() => parseTokenInput("   ")).toThrow();
    expect(() => parseTokenInput("-1")).toThrow(/positive/i);
    expect(() => parseTokenInput("1e18")).toThrow(/positive/i);
    expect(() => parseTokenInput("abc")).toThrow();
    expect(() => parseTokenInput("1.2.3")).toThrow();
  });
});
