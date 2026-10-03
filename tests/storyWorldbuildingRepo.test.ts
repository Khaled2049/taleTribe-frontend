import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureStoryData,
  StoryWorldbuildingRepo,
  type Character,
} from "@novelsync/story-data-client";
import type { PlotEvent, PlotLine } from "@/types/IPlot";

const character = (revision: number) =>
  ({ id: "c1", name: "Ada", revision }) as Character;
const event = (id: string, revision: number) =>
  ({ id, name: id, revision }) as PlotEvent;
const line = (revision: number) =>
  ({
    id: "l1",
    name: "Main",
    description: "",
    revision,
    events: [],
  }) as unknown as PlotLine;

let calls: { method: string; ifMatch: string | undefined }[];

function respondWith(...bodies: unknown[]) {
  const queue = [...bodies];
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      calls.push({
        method: init.method ?? "GET",
        ifMatch: headers["If-Match"],
      });
      const body = queue.shift();
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      });
    }),
  );
}

beforeEach(() => {
  calls = [];
  configureStoryData({
    baseUrl: "https://story-data.test",
    sendDevUserHeader: false,
    getAuthContext: async () => ({ uid: "u1", token: "t" }),
    getUid: () => "u1",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StoryWorldbuildingRepo If-Match", () => {
  it("does not let a newer read lend its revision to an older edit", async () => {
    const repo = new StoryWorldbuildingRepo();
    respondWith([character(5)], [character(6)], character(7));

    const [editing] = await repo.getCharacters("s1");
    await repo.getCharacters("s1");
    await repo.updateCharacter("s1", { ...editing, name: "Ada L." });

    expect(calls[2]).toMatchObject({ method: "PATCH", ifMatch: "5" });
  });

  it("chains this session's own successive writes", async () => {
    const repo = new StoryWorldbuildingRepo();
    respondWith(character(6), character(7));

    await repo.updateCharacter("s1", character(5));
    await repo.updateCharacter("s1", character(5));

    expect(calls.map((call) => call.ifMatch)).toEqual(["5", "6"]);
  });

  it("prefers a snapshot newer than this session's last write", async () => {
    const repo = new StoryWorldbuildingRepo();
    respondWith(character(6), character(10));

    await repo.updateCharacter("s1", character(5));
    await repo.updateCharacter("s1", character(9));

    expect(calls[1].ifMatch).toBe("9");
  });

  it("counts a reorder's line bump and renumbering as own writes", async () => {
    const repo = new StoryWorldbuildingRepo();
    const before = { ...line(3), events: [event("e1", 7), event("e2", 3)] };
    respondWith([event("e2", 4), event("e1", 8)], line(4), event("e1", 9));

    await repo.reorderEvents("s1", before, ["e2", "e1"]);
    await repo.updatePlotMeta("s1", { ...line(3), name: "Renamed" });
    await repo.updateEvent("s1", "l1", event("e1", 7));

    expect(calls.map((call) => call.ifMatch)).toEqual(["3", "4", "8"]);
  });

  it("does not adopt another writer's change carried by a renumbered sibling", async () => {
    const repo = new StoryWorldbuildingRepo();
    respondWith([event("e1", 3)], event("e1", 4));

    await repo.deleteEvent("s1", "l1", "e2", 1, [
      event("e1", 1),
      event("e2", 1),
    ]);
    await repo.updateEvent("s1", "l1", event("e1", 1));

    expect(calls.map((call) => call.ifMatch)).toEqual(["1", "2"]);
  });
});
