import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ExplanationRequest,
  RecommendationFilters,
  RecommendationRequest,
  recommendationService,
} from "@/cloudFunctions/recommendations";
import { queryKeys } from "./queryKeys";

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
  return useQuery({
    // The count is in the key: it decides how many items the cached payload
    // holds, so a widened shelf must not be served a narrower cached one.
    queryKey: queryKeys.recommendations.behavioral(
      userId ?? "",
      BEHAVIORAL_SHELF_SIZE,
      filters,
    ),
    queryFn: () =>
      recommendationService.recommend({
        mode: "behavioral",
        topK: BEHAVIORAL_SHELF_SIZE,
        filters,
      }),
    enabled: Boolean(userId) && enabled,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

export function useDiscoverStories() {
  return useMutation({
    mutationFn: (request: Extract<RecommendationRequest, { mode: "adhoc" }>) =>
      recommendationService.recommend(request),
  });
}

export function useRecommendationExplanation() {
  return useMutation({
    mutationFn: (request: ExplanationRequest) =>
      recommendationService.explain(request),
  });
}
