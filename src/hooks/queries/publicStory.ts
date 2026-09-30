import {
  queryOptions,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import {
  publicStoryRepo,
  readingHistoryRepo,
  storySocialRepo,
  type PublicStoryPage,
} from "@novelsync/story-data-client";
import { queryKeys } from "./queryKeys";

export type PublicStoryDetail = NonNullable<
  Awaited<ReturnType<typeof publicStoryRepo.getStoryDetail>>
>;

export interface StoryViewer {
  liked: boolean;
  rating: number | null;
  progress: { chapterId: string | null; scrollPercent: number };
}

export const publicStoryQuery = (storyId: string) =>
  queryOptions({
    queryKey: queryKeys.stories.detail(storyId),
    queryFn: () => publicStoryRepo.getStoryDetail(storyId),
    staleTime: 1000 * 60,
  });

const CHAPTER_FETCH_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Chapter fetch timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export const publicChapterQuery = (
  storyId: string,
  chapterId: string,
  authorId: string,
) =>
  queryOptions({
    queryKey: queryKeys.stories.chapter(storyId, chapterId),
    queryFn: () =>
      withTimeout(
        publicStoryRepo.getChapter(storyId, chapterId, authorId),
        CHAPTER_FETCH_TIMEOUT_MS,
      ),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
  });

export const storyViewerQuery = (storyId: string, uid: string) =>
  queryOptions({
    queryKey: queryKeys.stories.viewer(storyId, uid),
    queryFn: async (): Promise<StoryViewer> => {
      const [me, progress] = await Promise.all([
        storySocialRepo.getMe(storyId).catch(() => null),
        readingHistoryRepo.getProgress(storyId),
      ]);
      return {
        liked: me?.liked ?? false,
        rating: me?.rating ?? null,
        progress,
      };
    },
    staleTime: 0,
  });

export function publicStoryPlaceholder(
  client: QueryClient,
  storyId: string,
): PublicStoryDetail | undefined {
  const lists = client.getQueriesData<InfiniteData<PublicStoryPage>>({
    queryKey: queryKeys.stories.published(),
  });
  for (const [, data] of lists) {
    for (const page of data?.pages ?? []) {
      const story = page.stories.find((s) => s.id === storyId);
      if (story?.userId) {
        return {
          story: { ...story, userId: story.userId },
          chapters: [],
        };
      }
    }
  }
  return undefined;
}

export function usePublicStory(storyId: string | undefined) {
  const client = useQueryClient();
  return useQuery({
    ...publicStoryQuery(storyId ?? ""),
    enabled: !!storyId,
    placeholderData: () =>
      storyId ? publicStoryPlaceholder(client, storyId) : undefined,
  });
}

export function useStoryViewer(
  storyId: string | undefined,
  uid: string | null,
) {
  return useQuery({
    ...storyViewerQuery(storyId ?? "", uid ?? ""),
    enabled: !!storyId && !!uid,
  });
}
