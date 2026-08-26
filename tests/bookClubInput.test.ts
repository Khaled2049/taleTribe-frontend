import { describe, expect, it, vi } from "vitest";
import type { IClub } from "../src/types/IClub";

// The repo module pulls in Firestore for the realtime chat helpers, which the
// wire mapper under test has nothing to do with.
vi.mock("@novelsync/platform-auth", () => ({ firestore: {} }));

const { clubInput } = await import("../src/routes/BookClub/bookClubRepo");

// story-data decodes book club writes with DisallowUnknownFields, so any extra
// key is a 400 for the whole request rather than a silently ignored field.
// These are exactly the keys store.BookClubInput declares.
const ACCEPTED = [
  "name",
  "description",
  "image",
  "category",
  "activity",
  "meetUp",
];

const fullClub: IClub = {
  id: "client-generated-uuid",
  name: "The Glass Cartographers",
  description: "d",
  image: "",
  members: ["user-alice"],
  category: "c",
  activity: "New",
  creatorId: "user-alice",
  meetUp: "Thursdays",
  bookOfTheMonth: {
    id: "b1",
    volumeInfo: { title: "Piranesi" },
  },
  discussionPrompts: [],
  polls: [],
};

describe("clubInput", () => {
  it("sends only the fields the API accepts", () => {
    expect(Object.keys(clubInput(fullClub)).sort()).toEqual(
      [...ACCEPTED].sort(),
    );
  });

  it("drops the server-assigned identity fields", () => {
    const body = clubInput(fullClub) as Record<string, unknown>;
    // id comes from a new uuid, creatorId from the authed uid, and members
    // from the owner row the create transaction inserts.
    expect(body.id).toBeUndefined();
    expect(body.creatorId).toBeUndefined();
    expect(body.members).toBeUndefined();
  });

  it("preserves the user-entered values", () => {
    expect(clubInput(fullClub)).toEqual({
      name: "The Glass Cartographers",
      description: "d",
      image: "",
      category: "c",
      activity: "New",
      meetUp: "Thursdays",
    });
  });

  it("sends an empty meetUp rather than omitting it", () => {
    const { meetUp, ...rest } = fullClub;
    void meetUp;
    expect(clubInput(rest as IClub).meetUp).toBe("");
  });
});
