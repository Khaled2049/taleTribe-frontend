import { describe, expect, it } from "vitest";
import type {
  IClub,
  IDiscussionPrompt,
  IPoll,
  IPromptResponse,
} from "@/types/IClub";
import {
  withMember,
  withPoll,
  withPollClosed,
  withPrompt,
  withPromptResponse,
  withVote,
} from "@/lib/bookClubDetail";

const prompt = (id: string, responses: IPromptResponse[] = []) =>
  ({
    id,
    chapterNumber: 1,
    question: id,
    createdAt: "2026-10-01T00:00:00Z",
    creatorId: "owner",
    responses,
  }) satisfies IDiscussionPrompt;

const response = (id: string): IPromptResponse => ({
  id,
  userId: "u1",
  content: id,
  createdAt: "2026-10-01T00:00:00Z",
});

const poll = (id: string, votes: Record<string, number> = {}): IPoll => ({
  id,
  type: "book-selection",
  question: id,
  options: [{ text: "a" }, { text: "b" }],
  votes,
  createdAt: "2026-10-01T00:00:00Z",
  creatorId: "owner",
  isActive: true,
});

const club = (overrides: Partial<IClub> = {}): IClub => ({
  id: "c1",
  name: "Club",
  description: "",
  image: "",
  members: ["owner"],
  category: "",
  activity: "",
  creatorId: "owner",
  discussionPrompts: [],
  polls: [],
  ...overrides,
});

describe("withMember", () => {
  it("adds and removes a member", () => {
    const joined = withMember(club(), "u1", true);
    expect(joined.members).toEqual(["owner", "u1"]);
    expect(withMember(joined, "u1", false).members).toEqual(["owner"]);
  });

  it("returns the same club when membership already matches", () => {
    const c = club();
    expect(withMember(c, "owner", true)).toBe(c);
    expect(withMember(c, "u1", false)).toBe(c);
  });
});

describe("withPrompt", () => {
  it("appends a new prompt", () => {
    const next = withPrompt(
      club({ discussionPrompts: [prompt("p1")] }),
      prompt("p2"),
    );
    expect(next.discussionPrompts?.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("does not add a prompt a refetch already delivered", () => {
    const c = club({ discussionPrompts: [prompt("p1")] });
    expect(withPrompt(c, prompt("p1"))).toBe(c);
  });

  it("tolerates a club with no prompt list", () => {
    const next = withPrompt(
      club({ discussionPrompts: undefined }),
      prompt("p1"),
    );
    expect(next.discussionPrompts).toHaveLength(1);
  });
});

describe("withPromptResponse", () => {
  const c = club({
    discussionPrompts: [prompt("p1", [response("r1")]), prompt("p2")],
  });

  it("appends to the named prompt only", () => {
    const next = withPromptResponse(c, "p1", response("r2"));
    expect(next.discussionPrompts?.[0].responses?.map((r) => r.id)).toEqual([
      "r1",
      "r2",
    ]);
    expect(next.discussionPrompts?.[1]).toBe(c.discussionPrompts?.[1]);
  });

  it("does not duplicate a response already present", () => {
    const next = withPromptResponse(c, "p1", response("r1"));
    expect(next.discussionPrompts?.[0].responses).toHaveLength(1);
  });
});

describe("withPoll", () => {
  it("puts a new poll first", () => {
    const next = withPoll(club({ polls: [poll("a")] }), poll("b"));
    expect(next.polls?.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("does not add a poll already present", () => {
    const c = club({ polls: [poll("a")] });
    expect(withPoll(c, poll("a"))).toBe(c);
  });
});

describe("withVote", () => {
  const c = club({ polls: [poll("a", { u1: 0, u2: 1 }), poll("b")] });

  it("records a first vote", () => {
    expect(withVote(c, "b", "u1", 1).polls?.[1].votes).toEqual({ u1: 1 });
  });

  it("replaces the voter's earlier choice and leaves other votes alone", () => {
    expect(withVote(c, "a", "u1", 1).polls?.[0].votes).toEqual({
      u1: 1,
      u2: 1,
    });
  });

  it("does not touch other polls", () => {
    expect(withVote(c, "a", "u1", 1).polls?.[1]).toBe(c.polls?.[1]);
  });
});

describe("withPollClosed", () => {
  it("closes only the named poll", () => {
    const next = withPollClosed(club({ polls: [poll("a"), poll("b")] }), "a");
    expect(next.polls?.map((p) => p.isActive)).toEqual([false, true]);
  });
});
