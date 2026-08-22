import { request } from "../request";
import type { IGuestbookEntry } from "../types/IGuestbookEntry";
import type { IGuestbookReply } from "../types/IGuestbookReply";

type Vote = "up" | "down" | null;
type EntryPage = { entries: IGuestbookEntry[]; nextCursor?: string };

class GuestbookRepo {
    private request<T>(method: string, path: string, body?: unknown, required = false): Promise<T> {
        return request<T>(path, { method, body, auth: required ? "required" : "optional", label: "Guestbook request" });
    }
    private entry(x: IGuestbookEntry & { createdAt: string }): IGuestbookEntry { return { ...x, createdAt: new Date(x.createdAt), userVote: x.userVote || null }; }
    private reply(x: IGuestbookReply & { createdAt: string; updatedAt: string }): IGuestbookReply { return { ...x, createdAt: new Date(x.createdAt), updatedAt: new Date(x.updatedAt), userVote: x.userVote || null }; }
    async listEntries(ownerId: string, cursor?: string): Promise<{ entries: IGuestbookEntry[]; nextCursor?: string }> { const params = new URLSearchParams({ limit: "10" }); if (cursor) params.set("cursor", cursor); const page = await this.request<EntryPage>("GET", `/v1/public/guestbooks/${ownerId}/entries?${params}`); return { entries: page.entries.map((x) => this.entry(x as never)), nextCursor: page.nextCursor }; }
    async listReplies(ownerId: string, entryId: string): Promise<IGuestbookReply[]> { const x = await this.request<(IGuestbookReply & { createdAt: string; updatedAt: string })[]>("GET", `/v1/public/guestbooks/${ownerId}/entries/${entryId}/replies`); return x.map((r) => this.reply(r)); }
    createEntry(ownerId: string, content: string) { return this.request<IGuestbookEntry & { createdAt: string }>("POST", `/v1/guestbooks/${ownerId}/entries`, { content }, true).then((x) => this.entry(x)); }
    deleteEntry(ownerId: string, entryId: string) { return this.request<void>("DELETE", `/v1/guestbooks/${ownerId}/entries/${entryId}`, undefined, true); }
    createReply(ownerId: string, entryId: string, content: string, parentId: string | null) { return this.request<IGuestbookReply & { createdAt: string; updatedAt: string }>("POST", `/v1/guestbooks/${ownerId}/entries/${entryId}/replies`, { content, parentId: parentId || "" }, true).then((x) => this.reply(x)); }
    updateReply(ownerId: string, entryId: string, replyId: string, content: string) { return this.request<IGuestbookReply & { createdAt: string; updatedAt: string }>("PATCH", `/v1/guestbooks/${ownerId}/entries/${entryId}/replies/${replyId}`, { content }, true).then((x) => this.reply(x)); }
    deleteReply(ownerId: string, entryId: string, replyId: string) { return this.request<void>("DELETE", `/v1/guestbooks/${ownerId}/entries/${entryId}/replies/${replyId}`, undefined, true); }
    voteEntry(ownerId: string, entryId: string, vote: Vote) { return this.request<void>("PUT", `/v1/guestbooks/${ownerId}/entries/${entryId}/votes`, { vote: vote || "" }, true); }
    voteReply(ownerId: string, entryId: string, replyId: string, vote: Vote) { return this.request<void>("PUT", `/v1/guestbooks/${ownerId}/entries/${entryId}/replies/${replyId}/votes`, { vote: vote || "" }, true); }
}
export const guestbookRepo = new GuestbookRepo();
