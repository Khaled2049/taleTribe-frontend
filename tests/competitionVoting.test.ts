import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_VOTES_PER_USER,
  getMaxVotesPerUser,
} from "../src/lib/competitionListing";
import type { ICompetition } from "../src/types/ICompetition";

/** Only the fields getMaxVotesPerUser reads; the rest is irrelevant here. */
const competition = (
  votingRules?: ICompetition["votingRules"],
): ICompetition =>
  ({ votingRules }) as ICompetition;

describe("getMaxVotesPerUser", () => {
  it("falls back to the platform default when no rules are stored", () => {
    // Every competition written so far — nothing sets votingRules yet.
    expect(getMaxVotesPerUser(competition())).toBe(DEFAULT_MAX_VOTES_PER_USER);
    expect(getMaxVotesPerUser(competition({}))).toBe(
      DEFAULT_MAX_VOTES_PER_USER,
    );
  });

  it("honours a per-competition override", () => {
    expect(getMaxVotesPerUser(competition({ maxVotesPerUser: 1 }))).toBe(1);
    expect(getMaxVotesPerUser(competition({ maxVotesPerUser: 10 }))).toBe(10);
  });

  it("ignores overrides that would make the UI nonsensical", () => {
    // A zero or negative cap would disable every button while the server
    // carried on accepting ballots; a fractional one has no sane reading.
    for (const bad of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        getMaxVotesPerUser(competition({ maxVotesPerUser: bad })),
      ).toBe(DEFAULT_MAX_VOTES_PER_USER);
    }
  });

  it("ignores a non-numeric override from an untyped document", () => {
    // Firestore documents are not typed at runtime.
    const rules = { maxVotesPerUser: "3" } as unknown as ICompetition["votingRules"];
    expect(getMaxVotesPerUser(competition(rules))).toBe(
      DEFAULT_MAX_VOTES_PER_USER,
    );
  });

  it("stays in sync with the server default", () => {
    // DEFAULT_MAX_VOTES_PER_USER in functions/src/competitionEntryEndpoints.ts
    // is the authority. If that changes, this fails and points at the copy.
    expect(DEFAULT_MAX_VOTES_PER_USER).toBe(3);
  });
});
