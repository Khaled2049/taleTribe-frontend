import { useQueries } from "@tanstack/react-query";
import { createPublicClient, formatEther, formatUnits, http } from "viem";
import { activeChain } from "@/blockchain/chains";
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

// Story earnings are read from the configured contract chain. A wallet is not
// needed to read them, so My Shelf can render without mounting WagmiProvider.
const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(activeChain.rpcUrls.default.http[0]),
});

function expectBigInt(value: unknown): bigint {
  if (typeof value !== "bigint")
    throw new Error("Unexpected earnings response");
  return value;
}

/** Each story has its own chain-scoped cache entry, so loading another page
 * does not repeat earnings reads for stories already on screen. */
export function useStoryEarnings(uid: string | undefined, storyIds: string[]) {
  const ids = [...new Set(storyIds)].sort();

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.earnings.story(id, activeChain.id),
      queryFn: async (): Promise<StoryEarnings> => {
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
      enabled: !!uid,
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
