/**
 * Thrown when a daily quota from RateLimitService is exhausted. A named class
 * lets callers narrow with `instanceof` instead of casting the catch binding to
 * `any` to read a `code` property off it.
 */
export class RateLimitError extends Error {
  readonly code = "RATE_LIMIT_EXCEEDED" as const;

  constructor(
    message: string,
    readonly count?: number,
    readonly limit?: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export const isRateLimitError = (error: unknown): error is RateLimitError =>
  error instanceof RateLimitError;

/** Message to show the user, falling back to a generic line for other errors. */
export const rateLimitMessage = (error: unknown, fallback: string): string =>
  isRateLimitError(error) ? error.message : fallback;
