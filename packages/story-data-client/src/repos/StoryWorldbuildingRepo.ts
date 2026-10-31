import { request } from "../request.js";
import { getStoryDataConfig } from "../config.js";
import type { Character } from "../types/ICharacter.js";
import type { Place } from "../types/IPlace.js";
import type { PlotEvent, PlotLine } from "../types/IPlot.js";

export class StoryWorldbuildingRepo {
  private written = new Map<string, number>();

  private request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
    revision?: number,
  ): Promise<T> {
    return request<T>(path, {
      method,
      body,
      revision,
      auth: "required",
      label: "Worldbuilding request",
    });
  }

  private character(x: Character): Character {
    return {
      ...x,
      userId: getStoryDataConfig().getUid() ?? "",
      relationships: x.relationships ?? [],
    };
  }
  private place(x: Place): Place {
    return { ...x, userId: getStoryDataConfig().getUid() ?? "" };
  }
  private line(x: PlotLine): PlotLine {
    return { ...x, events: x.events.map((event) => this.event(event)) };
  }
  private event(x: PlotEvent): PlotEvent {
    return x;
  }
  private wrote<T extends { id: string; revision?: number }>(
    kind: string,
    x: T,
  ): T {
    if (x.revision) this.written.set(`${kind}:${x.id}`, x.revision);
    return x;
  }
  private rev(kind: string, id: string, snapshot?: number): number {
    const rev = Math.max(snapshot ?? 0, this.written.get(`${kind}:${id}`) ?? 0);
    if (!rev)
      throw new Error(
        "This item changed or has not been loaded. Reload and try again.",
      );
    return rev;
  }
  private characterInput(x: Omit<Character, "id" | "revision"> | Character) {
    const {
      id: _id,
      revision: _revision,
      userId: _userId,
      storyId: _storyId,
      ...input
    } = x as Character & { storyId?: string };
    return input;
  }
  private placeInput(x: Omit<Place, "id" | "revision"> | Place) {
    const {
      id: _id,
      revision: _revision,
      userId: _userId,
      storyId: _storyId,
      ...input
    } = x as Place;
    return input;
  }

  async getCharacters(storyId: string) {
    return (
      (await this.request<Character[]>(
        "GET",
        `/v1/stories/${storyId}/characters`,
      )) ?? []
    ).map((x) => this.character(x));
  }
  async addCharacter(storyId: string, x: Omit<Character, "id" | "revision">) {
    return this.character(
      this.wrote(
        "character",
        await this.request<Character>(
          "POST",
          `/v1/stories/${storyId}/characters`,
          this.characterInput(x),
        ),
      ),
    );
  }
  async updateCharacter(storyId: string, x: Character) {
    return this.character(
      this.wrote(
        "character",
        await this.request<Character>(
          "PATCH",
          `/v1/stories/${storyId}/characters/${x.id}`,
          this.characterInput(x),
          this.rev("character", x.id, x.revision),
        ),
      ),
    );
  }
  async deleteCharacter(storyId: string, id: string, revision?: number) {
    await this.request<void>(
      "DELETE",
      `/v1/stories/${storyId}/characters/${id}`,
      undefined,
      this.rev("character", id, revision),
    );
    this.written.delete(`character:${id}`);
  }

  async getPlaces(storyId: string) {
    return (
      (await this.request<Place[]>("GET", `/v1/stories/${storyId}/places`)) ??
      []
    ).map((x) => this.place(x));
  }
  async addPlace(storyId: string, x: Omit<Place, "id" | "revision">) {
    return this.place(
      this.wrote(
        "place",
        await this.request<Place>(
          "POST",
          `/v1/stories/${storyId}/places`,
          this.placeInput(x),
        ),
      ),
    );
  }
  async updatePlace(storyId: string, x: Place) {
    return this.place(
      this.wrote(
        "place",
        await this.request<Place>(
          "PATCH",
          `/v1/stories/${storyId}/places/${x.id}`,
          this.placeInput(x),
          this.rev("place", x.id, x.revision),
        ),
      ),
    );
  }
  async deletePlace(storyId: string, id: string, revision?: number) {
    await this.request<void>(
      "DELETE",
      `/v1/stories/${storyId}/places/${id}`,
      undefined,
      this.rev("place", id, revision),
    );
    this.written.delete(`place:${id}`);
  }

  async getPlots(storyId: string) {
    return (
      (await this.request<PlotLine[]>("GET", `/v1/stories/${storyId}/plots`)) ??
      []
    ).map((x) => this.line(x));
  }
  async addPlot(storyId: string, name: string, description = "") {
    return this.line(
      this.wrote(
        "plot",
        await this.request<PlotLine>("POST", `/v1/stories/${storyId}/plots`, {
          name,
          description,
        }),
      ),
    );
  }
  async addPlotWithEvents(
    storyId: string,
    line: { name: string; description?: string },
    events: Omit<PlotEvent, "id" | "revision">[],
  ) {
    const created = await this.request<PlotLine>(
      "POST",
      `/v1/stories/${storyId}/plots/with-events`,
      { line, events: events.map((event) => this.eventInput(event)) },
    );
    this.wrote("plot", created);
    created.events.forEach((event) => this.wrote("event", event));
    return this.line(created);
  }
  async updatePlotMeta(storyId: string, line: PlotLine) {
    return this.line(
      this.wrote(
        "plot",
        await this.request<PlotLine>(
          "PATCH",
          `/v1/stories/${storyId}/plots/${line.id}`,
          { name: line.name, description: line.description },
          this.rev("plot", line.id, line.revision),
        ),
      ),
    );
  }
  async deletePlot(storyId: string, id: string, revision?: number) {
    await this.request<void>(
      "DELETE",
      `/v1/stories/${storyId}/plots/${id}`,
      undefined,
      this.rev("plot", id, revision),
    );
    this.written.delete(`plot:${id}`);
  }
  private eventInput(x: Omit<PlotEvent, "id" | "revision"> | PlotEvent) {
    const {
      id: _id,
      revision: _revision,
      userId: _userId,
      dependents: _dependents,
      chapterPosition: _chapterPosition,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...input
    } = x as PlotEvent;
    return input;
  }
  async addEvent(
    storyId: string,
    lineId: string,
    x: Omit<PlotEvent, "id" | "revision">,
  ) {
    return this.event(
      this.wrote(
        "event",
        await this.request<PlotEvent>(
          "POST",
          `/v1/stories/${storyId}/plots/${lineId}/events`,
          this.eventInput(x),
        ),
      ),
    );
  }
  async addEvents(
    storyId: string,
    lineId: string,
    events: Omit<PlotEvent, "id" | "revision">[],
  ) {
    const created = await this.request<PlotEvent[]>(
      "POST",
      `/v1/stories/${storyId}/plots/${lineId}/events/batch`,
      { events: events.map((event) => this.eventInput(event)) },
    );
    created.forEach((event) => this.wrote("event", event));
    return created.map((event) => this.event(event));
  }
  async updateEvent(storyId: string, lineId: string, x: PlotEvent) {
    return this.event(
      this.wrote(
        "event",
        await this.request<PlotEvent>(
          "PATCH",
          `/v1/stories/${storyId}/plots/${lineId}/events/${x.id}`,
          this.eventInput(x),
          this.rev("event", x.id, x.revision),
        ),
      ),
    );
  }
  async deleteEvent(
    storyId: string,
    lineId: string,
    id: string,
    revision?: number,
  ) {
    const events = (
      await this.request<PlotEvent[]>(
        "DELETE",
        `/v1/stories/${storyId}/plots/${lineId}/events/${id}`,
        undefined,
        this.rev("event", id, revision),
      )
    ).map((x) => this.event(x));
    this.written.delete(`event:${id}`);
    return events;
  }
  /** Counts a write this session caused, without adopting anyone else's. */
  private bumped(kind: string, id: string, snapshot?: number) {
    const known = Math.max(
      snapshot ?? 0,
      this.written.get(`${kind}:${id}`) ?? 0,
    );
    if (known) this.written.set(`${kind}:${id}`, known + 1);
  }

  /**
   * Sets a chapter's event order. `orderedIds` must include every event already
   * in the chapter; `movedIn` are the listed events coming from elsewhere,
   * whose revisions the server bumps because their chapter changed.
   */
  async reorderChapterEvents(
    storyId: string,
    chapterId: string,
    orderedIds: string[],
    movedIn: { id: string; revision?: number }[] = [],
  ) {
    const lines = (
      (await this.request<PlotLine[]>(
        "POST",
        `/v1/stories/${storyId}/plots/chapter-order`,
        { chapterId, orderedIds },
      )) ?? []
    ).map((x) => this.line(x));
    for (const event of movedIn) this.bumped("event", event.id, event.revision);
    return lines;
  }

  /** Moves an event to another plot line at `toIndex`; both lines' revisions move. */
  async moveEvent(
    storyId: string,
    from: PlotLine,
    event: PlotEvent,
    to: PlotLine,
    toIndex: number,
  ) {
    const lines = (
      (await this.request<PlotLine[]>(
        "POST",
        `/v1/stories/${storyId}/plots/${from.id}/events/${event.id}/move`,
        { toPlotLineId: to.id, toIndex },
        this.rev("event", event.id, event.revision),
      )) ?? []
    ).map((x) => this.line(x));
    this.bumped("plot", from.id, from.revision);
    if (to.id !== from.id) this.bumped("plot", to.id, to.revision);
    return lines;
  }

  async reorderEvents(storyId: string, line: PlotLine, orderedIds: string[]) {
    const revision = this.rev("plot", line.id, line.revision);
    const events = (
      await this.request<PlotEvent[]>(
        "POST",
        `/v1/stories/${storyId}/plots/${line.id}/events/reorder`,
        { orderedIds },
        revision,
      )
    ).map((x) => this.event(x));
    this.written.set(`plot:${line.id}`, revision + 1);
    return events;
  }
}

export const storyWorldbuildingRepo = new StoryWorldbuildingRepo();
