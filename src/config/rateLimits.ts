/**
 * Rate limit configuration
 * These values control rate limits for various user actions to prevent abuse
 */
export const RATE_LIMITS = {
  /**
   * Maximum number of posts a user can create per day
   */
  MAX_POSTS_PER_DAY: 10,

  /**
   * Maximum number of comments a user can create per day
   */
  MAX_COMMENTS_PER_DAY: 10,

  // Message Limits
  /**
   * Maximum characters per message in book club chat
   */
  MAX_MESSAGE_SIZE_CHARS: 2000,

  /**
   * Maximum messages a user can send per day
   */
  MAX_MESSAGES_PER_DAY: 50,

  /**
   * Maximum messages a user can send per hour
   */
  MAX_MESSAGES_PER_HOUR: 10,

  // Book Search Limits
  /**
   * Maximum book searches per day
   */
  MAX_BOOK_SEARCHES_PER_DAY: 30,

  /**
   * Maximum book searches per hour
   */
  MAX_BOOK_SEARCHES_PER_HOUR: 10,

  // Poll Limits
  /**
   * Maximum polls a creator can create per day
   */
  MAX_POLLS_PER_DAY: 5,

  /**
   * Maximum options per poll
   */
  MAX_POLL_OPTIONS: 10,

  /**
   * Maximum characters for poll question
   */
  MAX_POLL_QUESTION_LENGTH: 500,

  /**
   * Maximum characters per poll option
   */
  MAX_POLL_OPTION_LENGTH: 200,

  /**
   * Maximum poll vote changes per hour
   */
  MAX_POLL_VOTE_CHANGES_PER_HOUR: 3,

  // Discussion Prompt Limits
  /**
   * Maximum discussion prompts a creator can create per day
   */
  MAX_DISCUSSION_PROMPTS_PER_DAY: 10,

  /**
   * Maximum characters for prompt question
   */
  MAX_PROMPT_QUESTION_LENGTH: 500,

  /**
   * Maximum characters for prompt description
   */
  MAX_PROMPT_DESCRIPTION_LENGTH: 1000,

  /**
   * Maximum prompt responses a user can add per day
   */
  MAX_PROMPT_RESPONSES_PER_DAY: 20,

  /**
   * Maximum characters per prompt response
   */
  MAX_PROMPT_RESPONSE_LENGTH: 2000,

} as const;
