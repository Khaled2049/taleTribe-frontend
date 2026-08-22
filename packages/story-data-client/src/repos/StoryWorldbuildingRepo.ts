import { request } from "../request";
import { getStoryDataConfig } from "../config";
import type { Character } from "../types/ICharacter";
import type { Place } from "../types/IPlace";
import type { PlotEvent, PlotLine } from "../types/IPlot";

export class StoryWorldbuildingRepo {
    private revisions = new Map<string, number>();

    private request<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, revision?: number): Promise<T> {
        return request<T>(path, { method, body, revision, auth: "required", label: "Worldbuilding request" });
    }

    private character(x: Character): Character { this.revisions.set(`character:${x.id}`, x.revision!); return { ...x, userId: getStoryDataConfig().getUid() ?? "", relationships: x.relationships ?? [] }; }
    private place(x: Place): Place { this.revisions.set(`place:${x.id}`, x.revision!); return { ...x, userId: getStoryDataConfig().getUid() ?? "" }; }
    private line(x: PlotLine): PlotLine { this.revisions.set(`plot:${x.id}`, x.revision!); return { ...x, events: x.events.map((event) => this.event(event)) }; }
    private event(x: PlotEvent): PlotEvent { this.revisions.set(`event:${x.id}`, x.revision!); return x; }
    private rev(kind: string, id: string, fallback?: number): number { const rev = this.revisions.get(`${kind}:${id}`) ?? fallback; if (!rev) throw new Error("This item changed or has not been loaded. Reload and try again."); return rev; }
    private characterInput(x: Omit<Character, "id" | "revision"> | Character) { const { id: _id, revision: _revision, userId: _userId, storyId: _storyId, ...input } = x as Character & { storyId?: string }; return input; }
    private placeInput(x: Omit<Place, "id" | "revision"> | Place) { const { id: _id, revision: _revision, userId: _userId, storyId: _storyId, ...input } = x as Place; return input; }

    async getCharacters(storyId: string) { return (await this.request<Character[]>("GET", `/v1/stories/${storyId}/characters`) ?? []).map((x) => this.character(x)); }
    async addCharacter(storyId: string, x: Omit<Character, "id" | "revision">) { return this.character(await this.request<Character>("POST", `/v1/stories/${storyId}/characters`, this.characterInput(x))); }
    async updateCharacter(storyId: string, x: Character) { return this.character(await this.request<Character>("PATCH", `/v1/stories/${storyId}/characters/${x.id}`, this.characterInput(x), this.rev("character", x.id, x.revision))); }
    async deleteCharacter(storyId: string, id: string, revision?: number) { await this.request<void>("DELETE", `/v1/stories/${storyId}/characters/${id}`, undefined, this.rev("character", id, revision)); }

    async getPlaces(storyId: string) { return (await this.request<Place[]>("GET", `/v1/stories/${storyId}/places`) ?? []).map((x) => this.place(x)); }
    async addPlace(storyId: string, x: Omit<Place, "id" | "revision">) { return this.place(await this.request<Place>("POST", `/v1/stories/${storyId}/places`, this.placeInput(x))); }
    async updatePlace(storyId: string, x: Place) { return this.place(await this.request<Place>("PATCH", `/v1/stories/${storyId}/places/${x.id}`, this.placeInput(x), this.rev("place", x.id, x.revision))); }
    async deletePlace(storyId: string, id: string, revision?: number) { await this.request<void>("DELETE", `/v1/stories/${storyId}/places/${id}`, undefined, this.rev("place", id, revision)); }

    async getPlots(storyId: string) { return (await this.request<PlotLine[]>("GET", `/v1/stories/${storyId}/plots`) ?? []).map((x) => this.line(x)); }
    async addPlot(storyId: string, name: string) { return this.line(await this.request<PlotLine>("POST", `/v1/stories/${storyId}/plots`, { name, description: "" })); }
    async updatePlotMeta(storyId: string, line: PlotLine) { return this.line(await this.request<PlotLine>("PATCH", `/v1/stories/${storyId}/plots/${line.id}`, { name: line.name, description: line.description }, this.rev("plot", line.id, line.revision))); }
    async deletePlot(storyId: string, id: string, revision?: number) { await this.request<void>("DELETE", `/v1/stories/${storyId}/plots/${id}`, undefined, this.rev("plot", id, revision)); }
    private eventInput(x: Omit<PlotEvent, "id" | "revision"> | PlotEvent) { const { id: _id, revision: _revision, userId: _userId, dependents: _dependents, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = x as PlotEvent; return input; }
    async addEvent(storyId: string, lineId: string, x: Omit<PlotEvent, "id" | "revision">) { return this.event(await this.request<PlotEvent>("POST", `/v1/stories/${storyId}/plots/${lineId}/events`, this.eventInput(x))); }
    async updateEvent(storyId: string, lineId: string, x: PlotEvent) { return this.event(await this.request<PlotEvent>("PATCH", `/v1/stories/${storyId}/plots/${lineId}/events/${x.id}`, this.eventInput(x), this.rev("event", x.id, x.revision))); }
    async deleteEvent(storyId: string, lineId: string, id: string, revision?: number) { return (await this.request<PlotEvent[]>("DELETE", `/v1/stories/${storyId}/plots/${lineId}/events/${id}`, undefined, this.rev("event", id, revision))).map((x) => this.event(x)); }
    async reorderEvents(storyId: string, line: PlotLine, orderedIds: string[]) {
        const revision = this.rev("plot", line.id, line.revision);
        const events = (await this.request<PlotEvent[]>("POST", `/v1/stories/${storyId}/plots/${line.id}/events/reorder`, { orderedIds }, revision)).map((x) => this.event(x));
        this.revisions.set(`plot:${line.id}`, revision + 1);
        return events;
    }
}

export const storyWorldbuildingRepo = new StoryWorldbuildingRepo();
