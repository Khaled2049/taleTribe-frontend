import { request } from "@novelsync/story-data-client";

export interface AdminMember {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
  createdAt: string;
  storyCount: number;
  publishedStoryCount: number;
}

const options = { auth: "required", devAdmin: true } as const;

export const adminMemberService = {
  list(search: string, cursor: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ q: search, cursor, limit: "24" });
    return request<{ members: AdminMember[]; nextCursor?: string }>(
      `/v1/admin/members?${params}`,
      { ...options, signal },
    );
  },
};

export interface MemberUsageDay {
  day: string;
  indexingPasses: number;
  recsSearches: number;
  recsExplains: number;
}

/** Story-data's own AI counters for one member: embedding passes and recommendation calls. */
export function memberUsage(
  userId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ from, to });
  return request<{ days: MemberUsageDay[] }>(
    `/v1/admin/members/${encodeURIComponent(userId)}/usage?${params}`,
    { ...options, signal },
  );
}
