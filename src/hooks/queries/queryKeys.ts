export const queryKeys = {
  stories: {
    all: () => ["stories"] as const,
    // Reserved for future non-category published list use-cases.
    published: () => ["stories", "published"] as const,
    byCategory: (category: string) =>
      ["stories", "published", category] as const,
    // Reserved for route-level detail migration.
    detail: (storyId: string) => ["stories", "detail", storyId] as const,
    chapters: (storyId: string) => ["stories", storyId, "chapters"] as const,
    chapter: (storyId: string, chapterId: string) =>
      ["stories", storyId, "chapters", chapterId] as const,
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
  posts: {
    feed: (feedType: string) => ["posts", "feed", feedType] as const,
  },
  comments: {
    byChapter: (storyId: string, chapterId: string) =>
      ["comments", storyId, chapterId] as const,
  },
  bookClubs: {
    all: () => ["bookClubs"] as const,
    detail: (clubId: string) => ["bookClubs", clubId] as const,
  },
  user: {
    walletAddress: (userId: string) =>
      ["user", userId, "walletAddress"] as const,
    stories: (userId: string) => ["user", userId, "stories"] as const,
    publicProfile: (userId: string) =>
      ["user", userId, "publicProfile"] as const,
    recentlyRead: (userId: string) => ["user", userId, "recentlyRead"] as const,
    aiCredits: (userId: string) => ["user", userId, "aiCredits"] as const,
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
  competitions: {
    all: () => ["competitions"] as const,
    list: (userId: string) => ["competitions", "list", userId] as const,
    drafts: (userId: string) => ["competitions", "drafts", userId] as const,
    detail: (competitionId: string) =>
      ["competitions", competitionId] as const,
    submissions: (competitionId: string) =>
      ["competitions", competitionId, "submissions"] as const,
    myBallot: (competitionId: string, userId: string) =>
      ["competitions", competitionId, "ballot", userId] as const,
  },
} as const;
