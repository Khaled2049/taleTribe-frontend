export const queryKeys = {
  stories: {
    all: () => ["stories"] as const,
    // Reserved for future non-category published list use-cases.
    published: () => ["stories", "published"] as const,
    byCategory: (category: string, search = "") =>
      ["stories", "published", category, search] as const,
    detail: (storyId: string) => ["stories", "detail", storyId] as const,
    viewer: (storyId: string, uid: string) =>
      ["stories", storyId, "viewer", uid] as const,
    chapters: (storyId: string) => ["stories", storyId, "chapters"] as const,
    chapter: (storyId: string, chapterId: string) =>
      ["stories", storyId, "chapters", chapterId] as const,
  },
  // Owner-only editing reads, scoped by uid so a cached draft never outlives
  // the account that fetched it.
  workspace: {
    all: (uid: string) => ["workspace", uid] as const,
    story: (uid: string, storyId: string) =>
      ["workspace", uid, storyId, "story"] as const,
    chapterIndex: (uid: string, storyId: string) =>
      ["workspace", uid, storyId, "chapterIndex"] as const,
    chapter: (uid: string, storyId: string, chapterId: string) =>
      ["workspace", uid, storyId, "chapter", chapterId] as const,
  },
  characters: {
    byStory: (storyId: string) => ["characters", storyId] as const,
  },
  places: {
    byStory: (storyId: string) => ["places", storyId] as const,
  },
  plots: {
    byStory: (storyId: string) => ["plots", storyId] as const,
  },
  guestbook: {
    byOwner: (ownerId: string) => ["guestbook", ownerId] as const,
    wall: (filter: string) => ["guestbook", "wall", filter] as const,
  },
  comments: {
    byStory: (storyId: string) => ["comments", storyId] as const,
  },
  bookClubs: {
    // A leaf of its own: under the bare prefix, invalidating the list would
    // take every cached detail and progress query with it.
    list: () => ["bookClubs", "list"] as const,
    mine: () => ["bookClubs", "mine"] as const,
    detail: (clubId: string) => ["bookClubs", clubId] as const,
    progress: (clubId: string) => ["bookClubs", clubId, "progress"] as const,
  },
  people: {
    search: (term: string) => ["people", "search", term] as const,
    directory: (sort: string) => ["people", "directory", sort] as const,
    // Sorted so a reordered follow array does not read as a different query.
    following: (uids: readonly string[]) =>
      ["people", "following", [...uids].sort()] as const,
    followers: (uids: readonly string[]) =>
      ["people", "followers", [...uids].sort()] as const,
    recentFollowers: () => ["people", "recentFollowers"] as const,
  },
  user: {
    stories: (userId: string) => ["user", userId, "stories"] as const,
    storyPages: (userId: string) => ["user", userId, "storyPages"] as const,
    // The one entry for a user's public profile. Wallet address and guestbook
    // policy are fields of it, read via `select` — never separate queries.
    publicProfile: (userId: string) =>
      ["user", userId, "publicProfile"] as const,
    recentlyRead: (userId: string) => ["user", userId, "recentlyRead"] as const,
    aiCredits: (userId: string) => ["user", userId, "aiCredits"] as const,
    // Sorted by the caller so a reordered list is not a different query.
    profileNames: (uids: readonly string[]) =>
      ["user", "profileNames", uids] as const,
  },
  earnings: {
    story: (storyId: string, chainId: number) =>
      ["earnings", "story", storyId, chainId] as const,
    lifetime: (walletAddress: string, chainId: number) =>
      ["earnings", "lifetime", walletAddress, chainId] as const,
  },
  token: {
    balance: (userId: string) => ["token", "balance", userId] as const,
  },
  recommendations: {
    behavioral: (userId: string, topK: number, filters?: unknown) =>
      ["recommendations", "behavioral", userId, topK, filters ?? null] as const,
  },
  competitions: {
    all: () => ["competitions"] as const,
    list: (userId: string) => ["competitions", "list", userId] as const,
    drafts: (userId: string) => ["competitions", "drafts", userId] as const,
    detail: (competitionId: string) => ["competitions", competitionId] as const,
    submissions: (competitionId: string) =>
      ["competitions", competitionId, "submissions"] as const,
    myBallot: (competitionId: string, userId: string) =>
      ["competitions", competitionId, "ballot", userId] as const,
  },
} as const;
