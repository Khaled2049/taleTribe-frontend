import { useQuery } from "@tanstack/react-query";
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

/** Chain reads stay separate from the owner list so slow RPC cannot hide rows. */
export function useStoryEarnings(uid: string | undefined, storyIds: string[]) {
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  const sortedIds = [...storyIds].sort();

  return useQuery({
    queryKey: queryKeys.earnings.owner(uid ?? "", chainId ?? 0, sortedIds),
    queryFn: async (): Promise<Record<string, StoryEarnings>> => {
      if (!publicClient) return {};
      const pairs = await Promise.all(
        sortedIds.map(async (id) => {
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
          return [
            id,
            {
              eth: formatEther(expectBigInt(ethRaw)),
              usdc: formatUnits(expectBigInt(usdcRaw), 6),
            },
          ] as const;
        }),
      );
      return Object.fromEntries(pairs);
    },
    enabled: !!uid && !!publicClient && sortedIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}
