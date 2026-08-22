import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatEther, formatUnits } from "viem";
import { usePublicClient, useChainId } from "wagmi";
import {
  tippingPlatformConfig,
  ZERO_ADDRESS,
} from "@/blockchain/tippingPlatform";
import { USDC_ADDRESS } from "@/blockchain/tokens";
import { queryKeys } from "@/hooks/queries/queryKeys";

interface EarningsData {
  eth: string;
  usdc: string;
}

const toBigInt = (value: unknown): bigint => {
  if (typeof value === "bigint") return value;
  return 0n;
};

export const useEarnings = () => {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const lifetimeQuery = useQuery<EarningsData>({
    queryKey: queryKeys.earnings.lifetime(walletAddress ?? "none", chainId),
    queryFn: async () => {
      if (!publicClient || !walletAddress) return { eth: "0", usdc: "0" };

      const [ethEarnings, usdcEarnings] = await Promise.all([
        publicClient
          .readContract({
            ...tippingPlatformConfig,
            functionName: "lifetimeEarnings",
            args: [walletAddress as `0x${string}`, ZERO_ADDRESS],
          })
          .catch(() => 0n),
        publicClient
          .readContract({
            ...tippingPlatformConfig,
            functionName: "lifetimeEarnings",
            args: [
              walletAddress as `0x${string}`,
              USDC_ADDRESS as `0x${string}`,
            ],
          })
          .catch(() => 0n),
      ]);

      return {
        eth: formatEther(toBigInt(ethEarnings)),
        usdc: formatUnits(toBigInt(usdcEarnings), 6),
      };
    },
    enabled: !!walletAddress && !!publicClient,
    staleTime: 1000 * 60 * 2,
  });

  // Single-trigger: set state → useQuery fires reactively on next render.
  // Previously also called queryClient.fetchQuery() here (double-fetch).
  const fetchLifetimeEarnings = useCallback((address: string) => {
    setWalletAddress(address);
  }, []);

  const fetchStoryEarnings = useCallback(
    async (storyId: string): Promise<EarningsData> => {
      if (!publicClient || !storyId) {
        return { eth: "0", usdc: "0" };
      }

      const [ethEarnings, usdcEarnings] = await Promise.all([
        publicClient
          .readContract({
            ...tippingPlatformConfig,
            functionName: "storyEarnings",
            args: [storyId, ZERO_ADDRESS],
          })
          .catch(() => 0n),
        publicClient
          .readContract({
            ...tippingPlatformConfig,
            functionName: "storyEarnings",
            args: [storyId, USDC_ADDRESS as `0x${string}`],
          })
          .catch(() => 0n),
      ]);

      return {
        eth: formatEther(toBigInt(ethEarnings)),
        usdc: formatUnits(toBigInt(usdcEarnings), 6),
      };
    },
    [publicClient],
  );

  return useMemo(
    () => ({
      lifetimeEarnings: lifetimeQuery.data ?? { eth: "0", usdc: "0" },
      fetchLifetimeEarnings,
      fetchStoryEarnings,
      loading: lifetimeQuery.isFetching,
      error: lifetimeQuery.error
        ? lifetimeQuery.error instanceof Error
          ? lifetimeQuery.error.message
          : "Failed to fetch earnings"
        : null,
    }),
    [
      lifetimeQuery.data,
      lifetimeQuery.error,
      lifetimeQuery.isFetching,
      fetchLifetimeEarnings,
      fetchStoryEarnings,
    ],
  );
};
