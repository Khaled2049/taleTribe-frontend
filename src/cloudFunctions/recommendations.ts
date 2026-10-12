import type {
  RecommendationData,
  RecommendationRequest,
  ExplanationRequest,
  RecommendationExplanation,
} from "@novelsync/reader-ui/recommendations";
export type {
  RecommendationFilters,
  RecommendationSeedBook,
  RecommendationItem,
  RecommendationData,
  RecommendationRequest,
  ExplanationRequest,
  RecommendationExplanation,
} from "@novelsync/reader-ui/recommendations";
import api from "./index";

interface RecommendationEnvelope {
  success: boolean;
  data: RecommendationData;
  error?: unknown;
}

interface ExplanationEnvelope {
  success: boolean;
  data: {
    query_fingerprint: string;
    explanations: RecommendationExplanation[];
  };
  error?: unknown;
}

class RecommendationService {
  async recommend(request: RecommendationRequest): Promise<RecommendationData> {
    const { data } = await api.post<RecommendationEnvelope>(
      "/recommendStories",
      request,
    );
    return data.data;
  }

  async explain(
    request: ExplanationRequest,
  ): Promise<RecommendationExplanation[]> {
    const { data } = await api.post<ExplanationEnvelope>(
      "/explainRecommendations",
      request,
    );
    return data.data.explanations;
  }
}

export const recommendationService = new RecommendationService();
