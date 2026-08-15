import { auth } from "@/config/firebase";

const baseURL = import.meta.env.VITE_STORY_DATA_URL || "/story-data";
export const PEOPLE_PAGE_SIZE = 20;

export interface PublicProfile {
  uid: string;
  username: string;
  photoURL?: string;
  bio?: string;
  occupation?: string;
  location?: string;
  walletAddress?: string;
  guestbookPolicy?: "everyone" | "followers" | "following" | "mutuals" | "nobody";
  createdAt: string;
  updatedAt: string;
}

export type ProfileUpdate = Partial<Pick<PublicProfile, "username" | "photoURL" | "bio" | "occupation" | "location" | "walletAddress" | "guestbookPolicy">>;

type ApiProfile = Omit<PublicProfile, "uid" | "photoURL"> & { userId: string; photoUrl?: string };

class ProfileRepo {
  private profile(api: ApiProfile): PublicProfile {
    return { ...api, uid: api.userId, photoURL: api.photoUrl || undefined };
  }

  private async request<T>(path: string, init?: RequestInit, authenticated = false): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set("Content-Type", "application/json");
    if (authenticated) {
      const user = auth.currentUser;
      if (!user) throw new Error("You must be signed in.");
      const token = await user.getIdToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (import.meta.env.DEV) headers.set("X-User-ID", user.uid);
    }
    const response = await fetch(`${baseURL}${path}`, { ...init, headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Profile request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  }

  async get(userId: string): Promise<PublicProfile | null> {
    try { return this.profile(await this.request<ApiProfile>(`/v1/public/profiles/${userId}`)); }
    catch (error) { if (error instanceof Error && error.message.includes("(404)")) return null; throw error; }
  }
  async searchByUsernamePrefix(prefix: string, max = PEOPLE_PAGE_SIZE): Promise<PublicProfile[]> {
    const query = prefix.trim(); if (!query) return [];
    const params = new URLSearchParams({ query, limit: String(Math.min(max, PEOPLE_PAGE_SIZE)) });
    return (await this.request<ApiProfile[]>(`/v1/public/profiles?${params}`)).map((x) => this.profile(x));
  }
  async listRecent(max = PEOPLE_PAGE_SIZE): Promise<PublicProfile[]> {
    return (await this.request<ApiProfile[]>(`/v1/public/profiles?limit=${Math.min(max, PEOPLE_PAGE_SIZE)}`)).map((x) => this.profile(x));
  }
  async getMany(userIds: string[]): Promise<Map<string, PublicProfile>> {
    const ids = [...new Set(userIds)].filter(Boolean).slice(0, 50); if (!ids.length) return new Map();
    const profiles = await this.request<ApiProfile[]>(`/v1/public/profiles?${new URLSearchParams({ ids: ids.join(","), limit: "50" })}`);
    return new Map(profiles.map((x) => { const profile = this.profile(x); return [profile.uid, profile]; }));
  }
  async getMe(): Promise<PublicProfile | null> {
    try { return this.profile(await this.request<ApiProfile>("/v1/profiles/me", undefined, true)); }
    catch (error) { if (error instanceof Error && error.message.includes("(404)")) return null; throw error; }
  }
  async createMe(data: Required<Pick<ProfileUpdate, "username">> & ProfileUpdate): Promise<PublicProfile> {
    return this.profile(await this.request<ApiProfile>("/v1/profiles/me", { method: "PUT", body: JSON.stringify(toApi(data)) }, true));
  }
  async updateMe(data: ProfileUpdate): Promise<PublicProfile> {
    return this.profile(await this.request<ApiProfile>("/v1/profiles/me", { method: "PATCH", body: JSON.stringify(toApi(data)) }, true));
  }
  async getMyFollows(): Promise<{ following: string[]; followers: string[] }> { return this.request("/v1/me/follows", undefined, true); }
  async setFollow(userId: string, following: boolean): Promise<void> { await this.request(`/v1/profiles/${userId}/follow`, { method: following ? "PUT" : "DELETE" }, true); }
}
const toApi = ({ photoURL, ...data }: ProfileUpdate) => ({
  ...data,
  ...(photoURL !== undefined ? { photoUrl: photoURL } : {}),
});
export const profileRepo = new ProfileRepo();
