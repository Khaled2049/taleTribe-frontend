import { describe, expect, it } from "vitest";
import {
  amountOrNull,
  emptyFormState,
  normalizeAmountInput,
  parseAmount,
  publishBlockers,
  toDraftInput,
  type CompetitionFormState,
} from "../src/lib/competitionDraft";

const filled = (overrides: Partial<CompetitionFormState> = {}) => ({
  ...emptyFormState(),
  title: "The Vellum Prize",
  description: "Write something worth reading.",
  category: "Fantasy",
  prizeAmount: "1000",
  ...overrides,
});

describe("normalizeAmountInput", () => {
  it("strips what people actually type into a money field", () => {
    expect(normalizeAmountInput("1,000")).toBe("1000");
    expect(normalizeAmountInput(" 1 000 ")).toBe("1000");
    expect(normalizeAmountInput("1000 TALE")).toBe("1000");
    expect(normalizeAmountInput("1,234.5")).toBe("1234.5");
  });
});

describe("parseAmount", () => {
  it("distinguishes blank from unparseable", () => {
    // The distinction the publish blockers depend on: telling someone to set a
    // prize they can see on screen is worse than saying nothing.
    expect(parseAmount("")).toBeUndefined();
    expect(parseAmount("   ")).toBeUndefined();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1000")).toBe("1000000000000000000000");
  });

  it("accepts a comma-formatted amount", () => {
    expect(parseAmount("1,000")).toBe("1000000000000000000000");
  });
});

describe("amountOrNull", () => {
  it("is null for blank, unparseable, and zero", () => {
    expect(amountOrNull("")).toBeNull();
    expect(amountOrNull("nope")).toBeNull();
    expect(amountOrNull("0")).toBeNull();
  });

  it("survives the punctuation the summary rail used to drop", () => {
    expect(amountOrNull("1,000")).toBe("1000000000000000000000");
  });
});

describe("publishBlockers", () => {
  it("lists every empty field on a fresh form", () => {
    expect(publishBlockers(emptyFormState())).toEqual([
      "Add a title",
      "Add a description",
      "Add a category",
      "Set a prize amount",
    ]);
  });

  it("clears once the form is complete", () => {
    expect(publishBlockers(filled())).toEqual([]);
  });

  /**
   * The regression behind "publish is greyed out forever": a comma-formatted
   * prize was dropped, so the form looked complete but reported a missing one.
   */
  it("accepts a comma-formatted prize", () => {
    expect(publishBlockers(filled({ prizeAmount: "1,000" }))).toEqual([]);
  });

  it("says a bad amount is unreadable, not missing", () => {
    expect(publishBlockers(filled({ prizeAmount: "lots" }))).toContain(
      "The prize amount isn't a number",
    );
    expect(publishBlockers(filled({ entryFee: "some" }))).toContain(
      "The entry fee isn't a number",
    );
  });

  it("ignores a blank entry fee — free entry is the default", () => {
    expect(publishBlockers(filled({ entryFee: "" }))).toEqual([]);
  });

  it("rejects a zero prize", () => {
    expect(publishBlockers(filled({ prizeAmount: "0" }))).toContain(
      "The prize must be greater than zero",
    );
  });

  it("catches an impossible schedule", () => {
    const start = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 16);
    const before = new Date(Date.now() + 864e5).toISOString().slice(0, 16);
    expect(publishBlockers(filled({ startDate: start, deadline: before }))).toContain(
      "Submissions must close after the start date",
    );
  });

  it("requires an hour of voting after submissions close", () => {
    const deadline = new Date(Date.now() + 864e5);
    const tooSoon = new Date(deadline.getTime() + 60_000);
    expect(
      publishBlockers(
        filled({
          deadline: deadline.toISOString().slice(0, 16),
          votingDeadline: tooSoon.toISOString().slice(0, 16),
        }),
      ),
    ).toContain("Voting must stay open at least an hour after submissions close");
  });
});

describe("toDraftInput", () => {
  it("omits an unparseable amount rather than sending garbage", () => {
    const input = toDraftInput(filled({ prizeAmount: "lots" }), undefined, "me");
    expect(input.prizeAmount).toBeUndefined();
  });

  it("carries a comma-formatted amount through", () => {
    const input = toDraftInput(filled({ prizeAmount: "1,000" }), undefined, "me");
    expect(input.prizeAmount).toBe("1000000000000000000000");
  });

  it("includes the id only when editing an existing draft", () => {
    expect(toDraftInput(filled(), undefined, "me").competitionId).toBeUndefined();
    expect(toDraftInput(filled(), "comp_1", "me").competitionId).toBe("comp_1");
  });
});
