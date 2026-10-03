import { useQueries } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { formatEther, formatUnits } from "viem";
import {
  tippingPlatformConfig,
  ZERO_ADDRESS,
} from "@/blockchain/tippingPlatform";
import { USDC_ADDRESS } from "@/blockchain/tokens";
import { queryKeys } from "./queryKeys";

export interface StoryEarnings {
  eth: string;
  usdc: string;
}

function expectBigInt(value: unknown): bigint {
  if (typeof value !== "bigint")
    throw new Error("Unexpected earnings response");
  return value;
}

/** Each story has its own chain-scoped cache entry, so loading another page
 * does not repeat earnings reads for stories already on screen. */
export function useStoryEarnings(uid: string | undefined, storyIds: string[]) {
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id ?? 0;
  const ids = [...new Set(storyIds)].sort();

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.earnings.story(id, chainId),
      queryFn: async (): Promise<StoryEarnings> => {
        if (!publicClient) throw new Error("Chain client unavailable");
        const [ethRaw, usdcRaw] = await Promise.all([
          publicClient.readContract({
            ...tippingPlatformConfig,
            functionName: "storyEarnings",
            args: [id, ZERO_ADDRESS],
          }),
          publicClient.readContract({
            ...tippingPlatformConfig,
            functionName: "storyEarnings",
            args: [id, USDC_ADDRESS as `0x${string}`],
          }),
        ]);
        return {
          eth: formatEther(expectBigInt(ethRaw)),
          usdc: formatUnits(expectBigInt(usdcRaw), 6),
        };
      },
      enabled: !!uid && !!publicClient,
      staleTime: 1000 * 60 * 5,
    })),
  });

  return {
    data: Object.fromEntries(
      results.flatMap((result, index) =>
        result.data ? [[ids[index], result.data] as const] : [],
      ),
    ) as Record<string, StoryEarnings>,
    isError: results.some((result) => result.isError),
  };
}
