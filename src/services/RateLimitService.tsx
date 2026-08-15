import {
  collection,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { RATE_LIMITS } from "@/config/rateLimits";

class RateLimitService {
  private userActivityCollection = collection(firestore, "userActivity");

  /**
   * Get today's date string in YYYY-MM-DD format (UTC)
   */
  private getTodayDateString(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Get user activity document reference
   */
  private getUserActivityDocRef(userId: string, dateString: string) {
    return doc(this.userActivityCollection, `${userId}_${dateString}`);
  }

  /**
   * Get current hour string in YYYY-MM-DD-HH format (UTC)
   */
  private getCurrentHourString(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hour = String(now.getUTCHours()).padStart(2, "0");
    return `${year}-${month}-${day}-${hour}`;
  }

  /**
   * Get today's post count for a user (using activity tracking)
   */
  async getTodayPostCount(userId: string): Promise<number> {
    try {
      const dateString = this.getTodayDateString();
      const activityDocRef = this.getUserActivityDocRef(userId, dateString);
      const activityDoc = await getDoc(activityDocRef);

      // No activity doc means no activity today. incrementPostCount() creates
      // it on the user's first action, so the counter is accurate from then on.
      return activityDoc.exists() ? activityDoc.data().postCount || 0 : 0;
    } catch (error) {
      console.error("Error getting today's post count:", error);
      // If there's an error, allow the action (fail open)
      return 0;
    }
  }

  /**
   * Get today's comment count for a user (using activity tracking)
   */
  async getTodayCommentCount(userId: string): Promise<number> {
    try {
      const dateString = this.getTodayDateString();
      const activityDocRef = this.getUserActivityDocRef(userId, dateString);
      const activityDoc = await getDoc(activityDocRef);

      return activityDoc.exists() ? activityDoc.data().commentCount || 0 : 0;
    } catch (error) {
      console.error("Error getting today's comment count:", error);
      // If there's an error, allow the action (fail open)
      return 0;
    }
  }

  /**
   * Increment post count for today
   */
  async incrementPostCount(userId: string): Promise<void> {
    try {
      const dateString = this.getTodayDateString();
      const activityDocRef = this.getUserActivityDocRef(userId, dateString);
      const activityDoc = await getDoc(activityDocRef);

      if (activityDoc.exists()) {
        await updateDoc(activityDocRef, {
          postCount: increment(1),
          lastUpdated: Timestamp.now(),
        });
      } else {
        await setDoc(activityDocRef, {
          userId,
          date: dateString,
          postCount: 1,
          commentCount: 0,
          lastUpdated: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error("Error incrementing post count:", error);
      // Don't throw - this is just for tracking
    }
  }

  /**
   * Increment comment count for today
   */
  async incrementCommentCount(userId: string): Promise<void> {
    try {
      const dateString = this.getTodayDateString();
      const activityDocRef = this.getUserActivityDocRef(userId, dateString);
      const activityDoc = await getDoc(activityDocRef);

      if (activityDoc.exists()) {
        await updateDoc(activityDocRef, {
          commentCount: increment(1),
          lastUpdated: Timestamp.now(),
        });
      } else {
        await setDoc(activityDocRef, {
          userId,
          date: dateString,
          postCount: 0,
          commentCount: 1,
          lastUpdated: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error("Error incrementing comment count:", error);
      // Don't throw - this is just for tracking
    }
  }

  /**
   * Check if user can create a post (hasn't exceeded daily limit)
   */
  async canCreatePost(userId: string): Promise<{
    allowed: boolean;
    count: number;
    limit: number;
    message?: string;
  }> {
    const count = await this.getTodayPostCount(userId);
    const limit = RATE_LIMITS.MAX_POSTS_PER_DAY;

    if (count >= limit) {
      return {
        allowed: false,
        count,
        limit,
        message: `You have reached the daily limit of ${limit} posts. Please try again tomorrow.`,
      };
    }

    return {
      allowed: true,
      count,
      limit,
    };
  }

  /**
   * Check if user can create a comment (hasn't exceeded daily limit)
   */
  async canCreateComment(userId: string): Promise<{
    allowed: boolean;
    count: number;
    limit: number;
    message?: string;
  }> {
    const count = await this.getTodayCommentCount(userId);
    const limit = RATE_LIMITS.MAX_COMMENTS_PER_DAY;

    if (count >= limit) {
      return {
        allowed: false,
        count,
        limit,
        message: `You have reached the daily limit of ${limit} comments. Please try again tomorrow.`,
      };
    }

    return {
      allowed: true,
      count,
      limit,
    };
  }

  /**
   * Generic method to get count for a specific field (daily)
   */
  private async getTodayCount(
    userId: string,
    fieldName: string,
  ): Promise<number> {
    try {
      const dateString = this.getTodayDateString();
      const activityDocRef = this.getUserActivityDocRef(userId, dateString);
      const activityDoc = await getDoc(activityDocRef);

      if (activityDoc.exists()) {
        return activityDoc.data()[fieldName] || 0;
      }

      return 0;
    } catch (error) {
      console.error(`Error getting today's ${fieldName}:`, error);
      return 0;
    }
  }

  /**
   * Generic method to get count for a specific field (hourly)
   */
  private async getHourlyCount(
    userId: string,
    fieldName: string,
  ): Promise<number> {
    try {
      const hourString = this.getCurrentHourString();
      const activityDocRef = doc(
        this.userActivityCollection,
        `${userId}_${hourString}`,
      );
      const activityDoc = await getDoc(activityDocRef);

      if (activityDoc.exists()) {
        return activityDoc.data()[fieldName] || 0;
      }

      return 0;
    } catch (error) {
      console.error(`Error getting hourly ${fieldName}:`, error);
      return 0;
    }
  }

  /**
   * Generic method to increment count for a specific field (daily)
   */
  private async incrementDailyCount(
    userId: string,
    fieldName: string,
  ): Promise<void> {
    try {
      const dateString = this.getTodayDateString();
      const activityDocRef = this.getUserActivityDocRef(userId, dateString);
      const activityDoc = await getDoc(activityDocRef);

      if (activityDoc.exists()) {
        await updateDoc(activityDocRef, {
          [fieldName]: increment(1),
          lastUpdated: Timestamp.now(),
        });
      } else {
        const initialData: Record<string, any> = {
          userId,
          date: dateString,
          [fieldName]: 1,
          lastUpdated: Timestamp.now(),
        };
        await setDoc(activityDocRef, initialData);
      }
    } catch (error) {
      console.error(`Error incrementing ${fieldName}:`, error);
    }
  }

  /**
   * Generic method to increment count for a specific field (hourly)
   */
  private async incrementHourlyCount(
    userId: string,
    fieldName: string,
  ): Promise<void> {
    try {
      const hourString = this.getCurrentHourString();
      const activityDocRef = doc(
        this.userActivityCollection,
        `${userId}_${hourString}`,
      );
      const activityDoc = await getDoc(activityDocRef);

      if (activityDoc.exists()) {
        await updateDoc(activityDocRef, {
          [fieldName]: increment(1),
          lastUpdated: Timestamp.now(),
        });
      } else {
        await setDoc(activityDocRef, {
          userId,
          hour: hourString,
          [fieldName]: 1,
          lastUpdated: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error(`Error incrementing hourly ${fieldName}:`, error);
    }
  }

  // Message Rate Limiting
  /**
   * Check if user can send a message (hasn't exceeded daily/hourly limits)
   */
  async canSendMessage(userId: string): Promise<{
    allowed: boolean;
    dailyCount: number;
    hourlyCount: number;
    dailyLimit: number;
    hourlyLimit: number;
    message?: string;
  }> {
    const dailyCount = await this.getTodayCount(userId, "messageCount");
    const hourlyCount = await this.getHourlyCount(userId, "messageCount");
    const dailyLimit = RATE_LIMITS.MAX_MESSAGES_PER_DAY;
    const hourlyLimit = RATE_LIMITS.MAX_MESSAGES_PER_HOUR;

    if (dailyCount >= dailyLimit) {
      return {
        allowed: false,
        dailyCount,
        hourlyCount,
        dailyLimit,
        hourlyLimit,
        message: `You have reached the daily limit of ${dailyLimit} messages. Please try again tomorrow.`,
      };
    }

    if (hourlyCount >= hourlyLimit) {
      return {
        allowed: false,
        dailyCount,
        hourlyCount,
        dailyLimit,
        hourlyLimit,
        message: `You have reached the hourly limit of ${hourlyLimit} messages. Please try again later.`,
      };
    }

    return {
      allowed: true,
      dailyCount,
      hourlyCount,
      dailyLimit,
      hourlyLimit,
    };
  }

  /**
   * Increment message count
   */
  async incrementMessageCount(userId: string): Promise<void> {
    await Promise.all([
      this.incrementDailyCount(userId, "messageCount"),
      this.incrementHourlyCount(userId, "messageCount"),
    ]);
  }

  // Book Search Rate Limiting
  /**
   * Check if user can search books (hasn't exceeded daily/hourly limits)
   */
  async canSearchBooks(userId: string): Promise<{
    allowed: boolean;
    dailyCount: number;
    hourlyCount: number;
    dailyLimit: number;
    hourlyLimit: number;
    message?: string;
  }> {
    const dailyCount = await this.getTodayCount(userId, "bookSearchCount");
    const hourlyCount = await this.getHourlyCount(userId, "bookSearchCount");
    const dailyLimit = RATE_LIMITS.MAX_BOOK_SEARCHES_PER_DAY;
    const hourlyLimit = RATE_LIMITS.MAX_BOOK_SEARCHES_PER_HOUR;

    if (dailyCount >= dailyLimit) {
      return {
        allowed: false,
        dailyCount,
        hourlyCount,
        dailyLimit,
        hourlyLimit,
        message: `You have reached the daily limit of ${dailyLimit} book searches. Please try again tomorrow.`,
      };
    }

    if (hourlyCount >= hourlyLimit) {
      return {
        allowed: false,
        dailyCount,
        hourlyCount,
        dailyLimit,
        hourlyLimit,
        message: `You have reached the hourly limit of ${hourlyLimit} book searches. Please try again later.`,
      };
    }

    return {
      allowed: true,
      dailyCount,
      hourlyCount,
      dailyLimit,
      hourlyLimit,
    };
  }

  /**
   * Increment book search count
   */
  async incrementBookSearchCount(userId: string): Promise<void> {
    await Promise.all([
      this.incrementDailyCount(userId, "bookSearchCount"),
      this.incrementHourlyCount(userId, "bookSearchCount"),
    ]);
  }

  // Poll Rate Limiting
  /**
   * Check if user can create a poll (hasn't exceeded daily limit)
   */
  async canCreatePoll(userId: string): Promise<{
    allowed: boolean;
    count: number;
    limit: number;
    message?: string;
  }> {
    const count = await this.getTodayCount(userId, "pollCount");
    const limit = RATE_LIMITS.MAX_POLLS_PER_DAY;

    if (count >= limit) {
      return {
        allowed: false,
        count,
        limit,
        message: `You have reached the daily limit of ${limit} polls. Please try again tomorrow.`,
      };
    }

    return {
      allowed: true,
      count,
      limit,
    };
  }

  /**
   * Increment poll count
   */
  async incrementPollCount(userId: string): Promise<void> {
    await this.incrementDailyCount(userId, "pollCount");
  }

  /**
   * Check if user can change poll vote (hasn't exceeded hourly limit)
   */
  async canChangePollVote(userId: string): Promise<{
    allowed: boolean;
    count: number;
    limit: number;
    message?: string;
  }> {
    const count = await this.getHourlyCount(userId, "voteChangeCount");
    const limit = RATE_LIMITS.MAX_POLL_VOTE_CHANGES_PER_HOUR;

    if (count >= limit) {
      return {
        allowed: false,
        count,
        limit,
        message: `You have reached the hourly limit of ${limit} vote changes. Please try again later.`,
      };
    }

    return {
      allowed: true,
      count,
      limit,
    };
  }

  /**
   * Increment vote change count
   */
  async incrementVoteChangeCount(userId: string): Promise<void> {
    await this.incrementHourlyCount(userId, "voteChangeCount");
  }

  // Discussion Prompt Rate Limiting
  /**
   * Check if user can create a discussion prompt (hasn't exceeded daily limit)
   */
  async canCreateDiscussionPrompt(userId: string): Promise<{
    allowed: boolean;
    count: number;
    limit: number;
    message?: string;
  }> {
    const count = await this.getTodayCount(userId, "promptCount");
    const limit = RATE_LIMITS.MAX_DISCUSSION_PROMPTS_PER_DAY;

    if (count >= limit) {
      return {
        allowed: false,
        count,
        limit,
        message: `You have reached the daily limit of ${limit} discussion prompts. Please try again tomorrow.`,
      };
    }

    return {
      allowed: true,
      count,
      limit,
    };
  }

  /**
   * Increment prompt count
   */
  async incrementPromptCount(userId: string): Promise<void> {
    await this.incrementDailyCount(userId, "promptCount");
  }

  /**
   * Check if user can add a prompt response (hasn't exceeded daily limit)
   */
  async canAddPromptResponse(userId: string): Promise<{
    allowed: boolean;
    count: number;
    limit: number;
    message?: string;
  }> {
    const count = await this.getTodayCount(userId, "promptResponseCount");
    const limit = RATE_LIMITS.MAX_PROMPT_RESPONSES_PER_DAY;

    if (count >= limit) {
      return {
        allowed: false,
        count,
        limit,
        message: `You have reached the daily limit of ${limit} prompt responses. Please try again tomorrow.`,
      };
    }

    return {
      allowed: true,
      count,
      limit,
    };
  }

  /**
   * Increment prompt response count
   */
  async incrementPromptResponseCount(userId: string): Promise<void> {
    await this.incrementDailyCount(userId, "promptResponseCount");
  }

}

export const rateLimitService = new RateLimitService();
