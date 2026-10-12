import { useReaderEnvironment } from "../../runtime.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ExplanationRequest,
  RecommendationFilters,
  RecommendationRequest,
} from "../../recommendations.js";
import { queryKeys } from "./queryKeys.js";

/**
 * One row of covers at the head of the story list, sized to the six columns
 * the catalog grid below it shows at its widest breakpoint.
 */
export const BEHAVIORAL_SHELF_SIZE = 6;

export function useBehavioralRecommendations(
  userId: string | null | undefined,
  filters?: RecommendationFilters,
  enabled = true,
) {
  const { recommendations } = useReaderEnvironment();
  return useQuery({
    // The count is in the key: it decides how many items the cached payload
    // holds, so a widened shelf must not be served a narrower cached one.
    queryKey: queryKeys.recommendations.behavioral(
      userId ?? "",
      BEHAVIORAL_SHELF_SIZE,
      filters,
    ),
    queryFn: () =>
      requireRecommendations(recommendations).recommend({
        mode: "behavioral",
        topK: BEHAVIORAL_SHELF_SIZE,
        filters,
      }),
    enabled: Boolean(userId) && enabled && !!recommendations,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

export function useDiscoverStories() {
  const { recommendations } = useReaderEnvironment();
  return useMutation({
    mutationFn: (request: Extract<RecommendationRequest, { mode: "adhoc" }>) =>
      requireRecommendations(recommendations).recommend(request),
  });
}

export function useRecommendationExplanation() {
  const { recommendations } = useReaderEnvironment();
  return useMutation({
    mutationFn: (request: ExplanationRequest) =>
      requireRecommendations(recommendations).explain(request),
  });
}

function requireRecommendations(
  transport:
    import("../../recommendations.js").RecommendationTransport | undefined,
) {
  if (!transport)
    throw new Error("Recommendations are unavailable in this app.");
  return transport;
}
