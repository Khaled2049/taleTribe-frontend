import { isNotFound } from "../errors";
import { request } from "../request";

export const PEOPLE_PAGE_SIZE = 20;

export interface PublicProfile {
    uid: string;
    username: string;
    photoURL?: string;
    firstName?: string;
    lastName?: string;
    bio?: string;
    occupation?: string;
    location?: string;
    writingInterests?: string;
    walletAddress?: string;
    guestbookPolicy?: "everyone" | "followers" | "following" | "mutuals" | "nobody";
    createdAt: string;
    updatedAt: string;
    /** How many follow them, and whether they've published anything — cheap
     * derived signals for the People directory, not tracked anywhere else. */
    followerCount: number;
    isWriter: boolean;
}

export interface RecentFollower {
    uid: string;
    username: string;
    followedAt: string;
}

export type ProfileUpdate = Partial<Pick<PublicProfile, "username" | "photoURL" | "firstName" | "lastName" | "bio" | "occupation" | "location" | "writingInterests" | "walletAddress" | "guestbookPolicy">>;

type ApiProfile = Omit<PublicProfile, "uid" | "photoURL"> & { userId: string; photoUrl?: string };
type ApiProfilePage = { profiles: ApiProfile[]; nextCursor?: string };
type ApiFollowerEntry = { userId: string; username: string; followedAt: string };

class ProfileRepo {
    private profile(api: ApiProfile): PublicProfile {
        return { ...api, uid: api.userId, photoURL: api.photoUrl || undefined };
    }
    private follower(api: ApiFollowerEntry): RecentFollower {
        return { uid: api.userId, username: api.username, followedAt: api.followedAt };
    }

    private request<T>(path: string, init?: { method?: string; body?: unknown }, authenticated = false): Promise<T> {
        return request<T>(path, {
            ...init,
            auth: authenticated ? "required" : "none",
            label: "Profile request",
        });
    }

    async get(userId: string): Promise<PublicProfile | null> {
        try { return this.profile(await this.request<ApiProfile>(`/v1/public/profiles/${userId}`)); }
        catch (error) { if (isNotFound(error)) return null; throw error; }
    }
    async searchByUsernamePrefix(prefix: string, max = PEOPLE_PAGE_SIZE): Promise<PublicProfile[]> {
        const query = prefix.trim(); if (!query) return [];
        const params = new URLSearchParams({ query, limit: String(Math.min(max, PEOPLE_PAGE_SIZE)) });
        return (await this.request<ApiProfilePage>(`/v1/public/profiles?${params}`)).profiles.map((x) => this.profile(x));
    }
    /** The paginated, sortable "browse everyone" directory — backs the People tab's "All members" segment. */
    async listMembers(opts: { sort?: "newest" | "az"; cursor?: string; limit?: number } = {}): Promise<{ profiles: PublicProfile[]; nextCursor?: string }> {
        const params = new URLSearchParams({ limit: String(Math.min(opts.limit ?? PEOPLE_PAGE_SIZE, PEOPLE_PAGE_SIZE)) });
        if (opts.sort) params.set("sort", opts.sort);
        if (opts.cursor) params.set("cursor", opts.cursor);
        const page = await this.request<ApiProfilePage>(`/v1/public/profiles?${params}`);
        return { profiles: page.profiles.map((x) => this.profile(x)), nextCursor: page.nextCursor };
    }
    async getMany(userIds: string[]): Promise<Map<string, PublicProfile>> {
        const ids = [...new Set(userIds)].filter(Boolean).slice(0, 50); if (!ids.length) return new Map();
        const page = await this.request<ApiProfilePage>(`/v1/public/profiles?${new URLSearchParams({ ids: ids.join(","), limit: "50" })}`);
        return new Map(page.profiles.map((x) => { const profile = this.profile(x); return [profile.uid, profile]; }));
    }
    async getMe(): Promise<PublicProfile | null> {
        try { return this.profile(await this.request<ApiProfile>("/v1/profiles/me", undefined, true)); }
        catch (error) { if (isNotFound(error)) return null; throw error; }
    }
    async createMe(data: Required<Pick<ProfileUpdate, "username">> & ProfileUpdate): Promise<PublicProfile> {
        return this.profile(await this.request<ApiProfile>("/v1/profiles/me", { method: "PUT", body: toApi(data) }, true));
    }
    async updateMe(data: ProfileUpdate): Promise<PublicProfile> {
        return this.profile(await this.request<ApiProfile>("/v1/profiles/me", { method: "PATCH", body: toApi(data) }, true));
    }
    async getMyFollows(): Promise<{ following: string[]; followers: string[] }> { return this.request("/v1/me/follows", undefined, true); }
    async setFollow(userId: string, following: boolean): Promise<void> { await this.request(`/v1/profiles/${userId}/follow`, { method: following ? "PUT" : "DELETE" }, true); }
    async getRecentFollowers(limit = PEOPLE_PAGE_SIZE): Promise<RecentFollower[]> {
        const x = await this.request<ApiFollowerEntry[]>(`/v1/me/followers/recent?limit=${limit}`, undefined, true);
        return x.map((f) => this.follower(f));
    }
}
const toApi = ({ photoURL, ...data }: ProfileUpdate) => ({
    ...data,
    ...(photoURL !== undefined ? { photoUrl: photoURL } : {}),
});
export const profileRepo = new ProfileRepo();
