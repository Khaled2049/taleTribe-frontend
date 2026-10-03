import { describe, expect, it } from "vitest";
import { withSelectionParam } from "@/lib/selectionParam";

describe("withSelectionParam", () => {
  it("sets the key and keeps the other parameters", () => {
    const next = withSelectionParam(
      new URLSearchParams("wizard=true&character=old"),
      "character",
      "new",
    );
    expect(next.toString()).toBe("wizard=true&character=new");
  });

  it("removes the key when nothing is selected", () => {
    const next = withSelectionParam(
      new URLSearchParams("place=p1&wizard=true"),
      "place",
      null,
    );
    expect(next.toString()).toBe("wizard=true");
  });

  it("does not modify the parameters it was given", () => {
    const params = new URLSearchParams("place=p1");
    withSelectionParam(params, "place", "p2");
    expect(params.toString()).toBe("place=p1");
  });
});
