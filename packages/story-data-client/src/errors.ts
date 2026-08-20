/**
 * Callers branch on `status`, not on message text. Several repos used to test
 * `message.includes("(404)")`, which the server can defeat just by returning a
 * `{ error }` body — that body replaces the generated message, and with it the
 * status code the caller was matching on.
 */
export class StoryDataError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "StoryDataError";
    this.status = status;
  }
}

/** A revision guard failed: the caller's `If-Match` is stale. */
export class StoryDataConflictError extends StoryDataError {
  constructor(message = "This changed elsewhere. Reload before saving again.") {
    super(409, message);
    this.name = "StoryDataConflictError";
  }
}

/** No signed-in user for a call that requires one — thrown before any fetch. */
export class StoryDataAuthError extends StoryDataError {
  constructor(message = "You must be signed in.") {
    super(401, message);
    this.name = "StoryDataAuthError";
  }
}

export const isNotFound = (error: unknown): boolean =>
  error instanceof StoryDataError && error.status === 404;
