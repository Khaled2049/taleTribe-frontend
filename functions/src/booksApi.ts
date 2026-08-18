/**
 * Books API proxy endpoint.
 * This endpoint proxies requests to Google Books API to protect the API key.
 * The API key is stored server-side and never exposed to the client.
 */
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { corsOptions } from "./corsConfig";
import { requireAuth } from "./authService";

const booksApiKey = defineSecret("BOOKS_API_KEY");
const booksApiOptions = { secrets: [booksApiKey], ...corsOptions };
const BOOKS_API_BASE_URL = "https://www.googleapis.com/books/v1";

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Search books endpoint.
 * GET /booksApi/search?q={query}&maxResults={maxResults}
 */
export const searchBooks = onRequest(booksApiOptions, requireAuth(async (req, res, _userId, _idToken) => {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = booksApiKey.value();
  if (!apiKey) {
    res.status(500).json({
      error:
        "Books API key not configured. Please set BOOKS_API_KEY secret.",
    });
    return;
  }

  try {
    const query = req.query.q as string;
    const maxResults = req.query.maxResults || "10";

    if (!query) {
      res.status(400).json({ error: "Query parameter 'q' is required" });
      return;
    }

    const url = new URL(`${BOOKS_API_BASE_URL}/volumes`);
    url.searchParams.set("q", query);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("maxResults", String(maxResults));

    const response = await fetchWithTimeout(url.toString(), 10000);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      const message = errorData?.error?.message || response.statusText;
      res.status(response.status).json({ error: message });
      return;
    }

    res.status(200).json(await response.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
}));
