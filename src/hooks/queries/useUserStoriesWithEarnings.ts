import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { formatEther, formatUnits } from "viem";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import {
  tippingPlatformConfig,
  ZERO_ADDRESS,
} from "@/blockchain/tippingPlatform";
import { USDC_ADDRESS } from "@/blockchain/tokens";
import { queryKeys } from "./queryKeys";

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

const NO_EARNINGS = { eth: "0", usdc: "0" } as const;

/** Fetches the owner's stories and their on-chain earnings in parallel per story. */
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
