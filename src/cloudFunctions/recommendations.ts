import api from "./index";

export interface RecommendationFilters {
  genres?: string[];
  themes?: string[];
  maxWordCount?: number;
  minWordCount?: number;
  author?: string;
  publishedAfter?: number;
}

export interface RecommendationSeedBook {
  title: string;
  author?: string;
}

export interface RecommendationItem {
  id: number;
  story_id: string;
  title: string;
  author?: string | null;
  genres: string[];
  themes: string[];
  tone: string[];
  core_premise?: string | null;
  published_year?: number | null;
  score: number;
  matched_query_count: number;
  explanation_cache_key?: string;
  breakdown?: {
    score: number;
    semantic: number;
    popularity: number;
    collaborative: number;
    weights: {
      semantic: number;
      popularity: number;
      collaborative: number;
    };
    alpha: number;
  };
}

export interface RecommendationData {
  mode: "adhoc" | "behavioral" | "popular";
  items: RecommendationItem[];
  degraded: boolean;
  diversity: number;
  candidates_considered: number;
  n_signals?: number;
  resolved_books?: Array<{ id: number; title: string }>;
  unresolved_books?: string[];
  hyde_used?: boolean;
  hypothetical_document?: {
    title: string;
    core_premise: string;
    themes: string[];
    tone: string[];
  } | null;
  query_fingerprint?: string;
}

interface RecommendationEnvelope {
  success: boolean;
  data: RecommendationData;
  error?: unknown;
}

export type RecommendationRequest =
  | {
      mode: "behavioral";
      topK?: number;
      filters?: RecommendationFilters;
    }
  | {
      mode: "adhoc";
      prompt?: string;
      books?: RecommendationSeedBook[];
      topK?: number;
      filters?: RecommendationFilters;
      useHyde?: boolean;
    };

export interface ExplanationRequest {
  itemIds: number[];
  prompt?: string;
  seedItemIds?: number[];
}

export interface RecommendationExplanation {
  item_id: number;
  explanation: string | null;
  cached: boolean;
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
