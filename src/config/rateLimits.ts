/**
 * Client-side limits.
 *
 * Two kinds live here, and the distinction matters. The *rate* limits below
 * cover book club chat and book search — the only actions this client still
 * meters itself, because one is Firestore-resident and the other calls an
 * external API. Every per-day quota for a story-data domain was removed when
 * those moved server-side, where they are enforced atomically in the same
 * transaction as the write and cannot be bypassed by a client.
 *
 * The *length* limits are form validation only. They mirror CHECK constraints
 * in story-data's schema so a user sees the error before the round trip —
 * KEEP IN SYNC with `migrations/000008_guestbook.sql` and
 * `migrations/000009_book_clubs.sql`; the server is the authority.
 */
export const RATE_LIMITS = {
  // Book club chat (Firestore-resident, so metered here).
  MAX_MESSAGE_SIZE_CHARS: 2000,
  MAX_MESSAGES_PER_DAY: 50,
  MAX_MESSAGES_PER_HOUR: 10,

  // Book search (external API, no server of ours in the path).
  MAX_BOOK_SEARCHES_PER_DAY: 30,
  MAX_BOOK_SEARCHES_PER_HOUR: 10,

  // Form validation — mirrors story-data's CHECK constraints.
  MAX_POLL_OPTIONS: 10,
  MAX_POLL_QUESTION_LENGTH: 500,
  MAX_POLL_OPTION_LENGTH: 200,
  MAX_PROMPT_QUESTION_LENGTH: 500,
  MAX_PROMPT_DESCRIPTION_LENGTH: 1000,
  MAX_PROMPT_RESPONSE_LENGTH: 2000,
} as const;
