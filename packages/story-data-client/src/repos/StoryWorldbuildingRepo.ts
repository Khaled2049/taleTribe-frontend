import { request } from "../request";
import { getStoryDataConfig } from "../config";
import type { Character } from "../types/ICharacter";
import type { Place } from "../types/IPlace";
import type { PlotEvent, PlotLine } from "../types/IPlot";

export class StoryWorldbuildingRepo {
    private written = new Map<string, number>();

    private request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, revision?: number): Promise<T> {
        return request<T>(path, { method, body, revision, auth: "required", label: "Worldbuilding request" });
    }

    private character(x: Character): Character { return { ...x, userId: getStoryDataConfig().getUid() ?? "", relationships: x.relationships ?? [] }; }
    private place(x: Place): Place { return { ...x, userId: getStoryDataConfig().getUid() ?? "" }; }
    private line(x: PlotLine): PlotLine { return { ...x, events: x.events.map((event) => this.event(event)) }; }
    private event(x: PlotEvent): PlotEvent { return x; }
    private wrote<T extends { id: string; revision?: number }>(kind: string, x: T): T { if (x.revision) this.written.set(`${kind}:${x.id}`, x.revision); return x; }
    private renumbered(before: { id: string; revision?: number }[] | undefined, after: PlotEvent[]) { const known = new Map((before ?? []).map((e) => [e.id, Math.max(e.revision ?? 0, this.written.get(`event:${e.id}`) ?? 0)])); for (const e of after) { const k = known.get(e.id); if (k) this.written.set(`event:${e.id}`, k + 1); } }
    private rev(kind: string, id: string, snapshot?: number): number { const rev = Math.max(snapshot ?? 0, this.written.get(`${kind}:${id}`) ?? 0); if (!rev) throw new Error("This item changed or has not been loaded. Reload and try again."); return rev; }
    private characterInput(x: Omit<Character, "id" | "revision"> | Character) { const { id: _id, revision: _revision, userId: _userId, storyId: _storyId, ...input } = x as Character & { storyId?: string }; return input; }
    private placeInput(x: Omit<Place, "id" | "revision"> | Place) { const { id: _id, revision: _revision, userId: _userId, storyId: _storyId, ...input } = x as Place; return input; }

    async getCharacters(storyId: string) { return (await this.request<Character[]>("GET", `/v1/stories/${storyId}/characters`) ?? []).map((x) => this.character(x)); }
    async addCharacter(storyId: string, x: Omit<Character, "id" | "revision">) { return this.character(this.wrote("character", await this.request<Character>("POST", `/v1/stories/${storyId}/characters`, this.characterInput(x)))); }
    async updateCharacter(storyId: string, x: Character) { return this.character(this.wrote("character", await this.request<Character>("PATCH", `/v1/stories/${storyId}/characters/${x.id}`, this.characterInput(x), this.rev("character", x.id, x.revision)))); }
    async deleteCharacter(storyId: string, id: string, revision?: number) { await this.request<void>("DELETE", `/v1/stories/${storyId}/characters/${id}`, undefined, this.rev("character", id, revision)); this.written.delete(`character:${id}`); }

    async getPlaces(storyId: string) { return (await this.request<Place[]>("GET", `/v1/stories/${storyId}/places`) ?? []).map((x) => this.place(x)); }
    async addPlace(storyId: string, x: Omit<Place, "id" | "revision">) { return this.place(this.wrote("place", await this.request<Place>("POST", `/v1/stories/${storyId}/places`, this.placeInput(x)))); }
    async updatePlace(storyId: string, x: Place) { return this.place(this.wrote("place", await this.request<Place>("PATCH", `/v1/stories/${storyId}/places/${x.id}`, this.placeInput(x), this.rev("place", x.id, x.revision)))); }
    async deletePlace(storyId: string, id: string, revision?: number) { await this.request<void>("DELETE", `/v1/stories/${storyId}/places/${id}`, undefined, this.rev("place", id, revision)); this.written.delete(`place:${id}`); }

    async getPlots(storyId: string) { return (await this.request<PlotLine[]>("GET", `/v1/stories/${storyId}/plots`) ?? []).map((x) => this.line(x)); }
    async addPlot(storyId: string, name: string) { return this.line(this.wrote("plot", await this.request<PlotLine>("POST", `/v1/stories/${storyId}/plots`, { name, description: "" }))); }
    async updatePlotMeta(storyId: string, line: PlotLine) { return this.line(this.wrote("plot", await this.request<PlotLine>("PATCH", `/v1/stories/${storyId}/plots/${line.id}`, { name: line.name, description: line.description }, this.rev("plot", line.id, line.revision)))); }
    async deletePlot(storyId: string, id: string, revision?: number) { await this.request<void>("DELETE", `/v1/stories/${storyId}/plots/${id}`, undefined, this.rev("plot", id, revision)); this.written.delete(`plot:${id}`); }
    private eventInput(x: Omit<PlotEvent, "id" | "revision"> | PlotEvent) { const { id: _id, revision: _revision, userId: _userId, dependents: _dependents, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = x as PlotEvent; return input; }
    async addEvent(storyId: string, lineId: string, x: Omit<PlotEvent, "id" | "revision">) { return this.event(this.wrote("event", await this.request<PlotEvent>("POST", `/v1/stories/${storyId}/plots/${lineId}/events`, this.eventInput(x)))); }
    async updateEvent(storyId: string, lineId: string, x: PlotEvent) { return this.event(this.wrote("event", await this.request<PlotEvent>("PATCH", `/v1/stories/${storyId}/plots/${lineId}/events/${x.id}`, this.eventInput(x), this.rev("event", x.id, x.revision)))); }
    async deleteEvent(storyId: string, lineId: string, id: string, revision?: number, siblings?: { id: string; revision?: number }[]) { const events = (await this.request<PlotEvent[]>("DELETE", `/v1/stories/${storyId}/plots/${lineId}/events/${id}`, undefined, this.rev("event", id, revision))).map((x) => this.event(x)); this.renumbered(siblings, events); this.written.delete(`event:${id}`); return events; }
    async reorderEvents(storyId: string, line: PlotLine, orderedIds: string[]) {
        const revision = this.rev("plot", line.id, line.revision);
        const events = (await this.request<PlotEvent[]>("POST", `/v1/stories/${storyId}/plots/${line.id}/events/reorder`, { orderedIds }, revision)).map((x) => this.event(x));
        this.renumbered(line.events, events);
        this.written.set(`plot:${line.id}`, revision + 1);
        return events;
    }
}

export const storyWorldbuildingRepo = new StoryWorldbuildingRepo();
