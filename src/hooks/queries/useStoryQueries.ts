import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { formatEther, formatUnits } from "viem";
import { queryKeys } from "./queryKeys";
import { publicStoryRepo } from "@novelsync/story-data-client";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import {
  tippingPlatformConfig,
  ZERO_ADDRESS,
} from "@/blockchain/tippingPlatform";
import { USDC_ADDRESS } from "@/blockchain/tokens";
import { auth } from "@novelsync/platform-auth";
import { storageService } from "@/services/StorageService";

async function updateStoryCover(
  storyId: string,
  imageFile: File | null,
  previewUrl: string | null,
) {
  const user = auth.currentUser;
  if (!user)
    throw new Error("You must be signed in to update the cover image.");
  const story = await storyWorkspaceRepo.getStory(storyId);
  if (!story) throw new Error("Story not found");
  if (story.userId !== user.uid)
    throw new Error("You do not have permission to update this cover.");
  if (story.coverImageUrl)
    await storageService.deleteCoverImage(story.coverImageUrl);
  if (story.thumbnailUrl && story.thumbnailUrl !== story.coverImageUrl)
    await storageService.deleteCoverImage(story.thumbnailUrl);
  let coverImageUrl = "";
  let thumbnailUrl = "";
  if (imageFile) {
    ({ coverImageUrl, thumbnailUrl } = await storageService.uploadCoverImage(
      imageFile,
      user.uid,
      storyId,
    ));
  } else if (previewUrl?.startsWith("data:")) {
    ({ coverImageUrl, thumbnailUrl } = await storageService.uploadCoverImage(
      storageService.dataUrlToFile(previewUrl),
      user.uid,
      storyId,
    ));
  }
  return storyWorkspaceRepo.updateStory({
    ...story,
    coverImageUrl,
    thumbnailUrl,
  });
}

const toBigInt = (value: unknown): bigint => {
  if (typeof value === "bigint") return value;
  return 0n;
};

export type StoryWithEarnings = Awaited<
  ReturnType<typeof storyWorkspaceRepo.getUserStories>
>[number] & {
  earnings: {
    eth: string;
    usdc: string;
  };
};

/**
 * Cursor-paginated published stories for the discovery grid.
 * Pages are fetched on demand (infinite scroll); each page carries the
 * API cursor for the next fetch. `getNextPageParam` returns undefined
 * once the repo reports a null cursor, which sets `hasNextPage` to false.
 */
export function usePublishedStories(category: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.stories.byCategory(category),
    queryFn: ({ pageParam }) =>
      category === "all"
        ? publicStoryRepo.getPublishedStories(pageParam)
        : publicStoryRepo.getPublishedStories(pageParam, category),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    staleTime: 1000 * 60 * 5, // 5 min — story lists are low-churn
  });
}

const NO_EARNINGS = { eth: "0", usdc: "0" } as const;

/**
 * Fetches user's own stories and their on-chain earnings in one query.
 * Earnings are fetched in parallel (fixes the N+1 problem).
 *
 * Only `userId` gates the query. The shelf is primarily a list of the user's
 * writing, so it must not sit disabled — rendering as an empty list — while
 * wagmi settles; a story with no reachable chain simply reports zero earnings.
 */
export function useUserStoriesWithEarnings(userId: string | undefined) {
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;

  return useQuery<StoryWithEarnings[]>({
    // Include chainId so a network switch invalidates stale earnings data.
    queryKey: [...queryKeys.user.stories(userId!), chainId] as const,
    queryFn: async () => {
      const storyList = await storyWorkspaceRepo.getUserStories();
      if (!publicClient) {
        return storyList.map((story) => ({ ...story, earnings: NO_EARNINGS }));
      }
      return Promise.all(
        storyList.map(async (story) => {
          const [ethRaw, usdcRaw] = await Promise.all([
            publicClient
              .readContract({
                ...tippingPlatformConfig,
                functionName: "storyEarnings",
                args: [story.id, ZERO_ADDRESS],
              })
              .catch(() => 0n),
            publicClient
              .readContract({
                ...tippingPlatformConfig,
                functionName: "storyEarnings",
                args: [story.id, USDC_ADDRESS as `0x${string}`],
              })
              .catch(() => 0n),
          ]);

          return {
            ...story,
            earnings: {
              eth: formatEther(toBigInt(ethRaw)),
              usdc: formatUnits(toBigInt(usdcRaw), 6),
            },
          };
        }),
      );
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useDeleteStory(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) =>
      storyWorkspaceRepo.deleteStoryByID(storyId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.stories(userId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stories.all(),
      });
    },
  });
}

export function useTogglePublishStory(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storyId: string) => {
      const story = await storyWorkspaceRepo.getStory(storyId);
      if (!story) throw new Error("Story not found");
      return storyWorkspaceRepo.updateStory({
        ...story,
        isPublished: !story.isPublished,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.stories(userId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.stories.all(),
      });
    },
  });
}

export function useUpdateStoryMetadata(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      storyId,
      data,
    }: {
      storyId: string;
      data: {
        title: string;
        description: string;
        category?: string;
        tags?: string[];
        targetAudience?: string;
        language?: string;
        copyright?: string;
      };
    }) => storyWorkspaceRepo.updateStoryByID(storyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.stories(userId!),
      });
    },
  });
}

export function useUpdateStoryCover(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      storyId,
      imageFile,
      previewUrl,
    }: {
      storyId: string;
      imageFile: File | null;
      previewUrl: string | null;
    }) => updateStoryCover(storyId, imageFile, previewUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.stories(userId!),
      });
    },
  });
}
