/**
 * Authenticated browser bridge to the private recommendation service.
 *
 * **This file is the trust boundary.** Two properties must survive any edit:
 *
 * 1. `user_id` is set from `userId` — resolved by `requireAuth` from the caller's
 *    verified Firebase ID token — and never from the request body. The Zod schemas
 *    are `.strict()`, so a `user_id` in the body is rejected rather than silently
 *    overriding. `/recommend/behavioral` returns recommendations derived from a
 *    reader's private history; without this, any browser could request any reader's
 *    shelf by typing their uid. recs trusts the `user_id` in its request body
 *    precisely because this Function put it there.
 * 2. The browser never receives the Cloud Run URL or a Google OIDC token —
 *    `transport.ts` mints it server-side.
 *
 * Note `upstreamFilters()` below: the browser speaks camelCase and recs speaks
 * snake_case. An unmapped field arrives as `None` upstream and the filter silently
 * does nothing, so adding a filter means editing this function too.
 *
 * Full trace of this path — both UI surfaces, the response contract, the caching
 * and the known SSE gap — is in taleTribe-recs:
 * `recommendation_engine/docs/frontend-integration.md`.
 */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { z } from "zod";
import { requireAuth } from "../infra/authService";
import { corsOptions } from "../infra/corsConfig";
import {
  callRecommendationService,
  RecommendationServiceError,
} from "../recommendations/transport";

const filtersSchema = z
  .object({
    genres: z.array(z.string().min(1).max(80)).max(20).optional(),
    themes: z.array(z.string().min(1).max(80)).max(20).optional(),
    maxWordCount: z.number().int().positive().optional(),
    minWordCount: z.number().int().nonnegative().optional(),
    author: z.string().trim().min(1).max(200).optional(),
    publishedAfter: z.number().int().min(0).max(3000).optional(),
  })
  .strict();

const seedBookSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    author: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

const recommendationSchema = z
  .object({
    mode: z.enum(["behavioral", "adhoc"]),
    prompt: z.string().trim().min(1).max(2000).optional(),
    books: z.array(seedBookSchema).max(10).optional(),
    topK: z.number().int().min(1).max(50).default(12),
    filters: filtersSchema.optional(),
    useHyde: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.mode === "adhoc" &&
      !value.prompt &&
      !(value.books && value.books.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "Ad-hoc discovery requires a prompt or at least one story",
      });
    }
  });

const explanationSchema = z
  .object({
    itemIds: z.array(z.number().int().positive()).min(1).max(25),
    prompt: z.string().trim().min(1).max(2000).optional(),
    seedItemIds: z.array(z.number().int().positive()).max(25).default([]),
  })
  .strict();

function upstreamFilters(filters: z.infer<typeof filtersSchema> | undefined) {
  if (!filters) return undefined;
  return {
    genres: filters.genres,
    themes: filters.themes,
    max_word_count: filters.maxWordCount,
    min_word_count: filters.minWordCount,
    author: filters.author,
    published_after: filters.publishedAfter,
  };
}

function validationError(error: z.ZodError) {
  return {
    error: "Invalid recommendation request",
    code: "VALIDATION_ERROR",
    details: error.issues.map((issue) => issue.message).join("; "),
  };
}

function sendFailure(
  response: Parameters<Parameters<typeof requireAuth>[0]>[1],
  error: unknown,
  userId: string,
) {
  if (error instanceof RecommendationServiceError) {
    response.status(error.status).json(error.payload);
    return;
  }
  logger.error("Recommendation service request failed", { userId, error });
  response.status(502).json({
    error: "Recommendations are temporarily unavailable",
    code: "RECOMMENDATIONS_UNAVAILABLE",
  });
}

const handleRecommendStories = requireAuth(
  async (request, response, userId) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    const parsed = recommendationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json(validationError(parsed.error));
      return;
    }

    const value = parsed.data;
    const path =
      value.mode === "behavioral"
        ? "/recommend/behavioral"
        : "/recommend/adhoc";
    let body: Record<string, unknown>;
    if (value.mode === "behavioral") {
      body = {
        user_id: userId,
        top_k: value.topK,
        filters: upstreamFilters(value.filters),
      };
    } else {
      body = {
        user_id: userId,
        prompt: value.prompt,
        books: value.books ?? [],
        top_k: value.topK,
        filters: upstreamFilters(value.filters),
        use_hyde: value.useHyde,
      };
    }

    try {
      const result = await callRecommendationService(path, body);
      response.status(200).json(result);
    } catch (error) {
      sendFailure(response, error, userId);
    }
  },
);

const handleExplainRecommendations = requireAuth(
  async (request, response, userId) => {
    if (request.method !== "POST") {
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    const parsed = explanationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json(validationError(parsed.error));
      return;
    }

    try {
      const result = await callRecommendationService(
        "/recommend/explain",
        {
          user_id: userId,
          item_ids: parsed.data.itemIds,
          prompt: parsed.data.prompt,
          seed_item_ids: parsed.data.seedItemIds,
        },
        60_000,
      );
      response.status(200).json(result);
    } catch (error) {
      sendFailure(response, error, userId);
    }
  },
);

export const recommendStories = onRequest(
  { ...corsOptions, timeoutSeconds: 60 },
  handleRecommendStories,
);

export const explainRecommendations = onRequest(
  { ...corsOptions, timeoutSeconds: 90 },
  handleExplainRecommendations,
);

export const recommendationSchemas = {
  recommendationSchema,
  explanationSchema,
};
