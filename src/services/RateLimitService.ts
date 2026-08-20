import {
  collection,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { firestore } from "@novelsync/platform-auth";
import { RATE_LIMITS } from "@/config/rateLimits";

/**
 * Client-side daily/hourly counters in Firestore `userActivity`.
 *
 * Only two features still need this: book club chat, which is the last
 * Firestore-resident feature, and book search, which hits an external API and
 * so has no server of ours to meter it. Everything story-data owns — comments,
 * guestbook entries, polls, discussion prompts — is metered server-side
 * instead, atomically and in the same transaction as the write.
 *
 * The counters fail open: a read error allows the action rather than blocking
 * a user because Firestore hiccuped.
 */
type RateLimitResult = {
  allowed: boolean;
  dailyCount: number;
  hourlyCount: number;
  dailyLimit: number;
  hourlyLimit: number;
  message?: string;
};

class RateLimitService {
  private userActivityCollection = collection(firestore, "userActivity");

  private getTodayDateString(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getCurrentHourString(): string {
    return `${this.getTodayDateString()}-${String(new Date().getUTCHours()).padStart(2, "0")}`;
  }

  private getUserActivityDocRef(userId: string, bucket: string) {
    return doc(this.userActivityCollection, `${userId}_${bucket}`);
  }

  private async getCount(
    userId: string,
    bucket: string,
    fieldName: string,
  ): Promise<number> {
    try {
      const snapshot = await getDoc(this.getUserActivityDocRef(userId, bucket));
      return snapshot.exists() ? snapshot.data()[fieldName] || 0 : 0;
    } catch (error) {
      console.error(`Error reading ${fieldName} for ${bucket}:`, error);
      return 0;
    }
  }

  private async incrementCount(
    userId: string,
    bucket: string,
    bucketField: "date" | "hour",
    fieldName: string,
  ): Promise<void> {
    try {
      const ref = this.getUserActivityDocRef(userId, bucket);
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        await updateDoc(ref, {
          [fieldName]: increment(1),
          lastUpdated: Timestamp.now(),
        });
      } else {
        await setDoc(ref, {
          userId,
          [bucketField]: bucket,
          [fieldName]: 1,
          lastUpdated: Timestamp.now(),
        });
      }
    } catch (error) {
      console.error(`Error incrementing ${fieldName}:`, error);
    }
  }

  private async check(
    userId: string,
    fieldName: string,
    dailyLimit: number,
    hourlyLimit: number,
    noun: string,
  ): Promise<RateLimitResult> {
    const [dailyCount, hourlyCount] = await Promise.all([
      this.getCount(userId, this.getTodayDateString(), fieldName),
      this.getCount(userId, this.getCurrentHourString(), fieldName),
    ]);
    const counts = { dailyCount, hourlyCount, dailyLimit, hourlyLimit };

    if (dailyCount >= dailyLimit) {
      return {
        allowed: false,
        ...counts,
        message: `You have reached the daily limit of ${dailyLimit} ${noun}. Please try again tomorrow.`,
      };
    }
    if (hourlyCount >= hourlyLimit) {
      return {
        allowed: false,
        ...counts,
        message: `You have reached the hourly limit of ${hourlyLimit} ${noun}. Please try again later.`,
      };
    }
    return { allowed: true, ...counts };
  }

  private increment(userId: string, fieldName: string): Promise<void[]> {
    return Promise.all([
      this.incrementCount(userId, this.getTodayDateString(), "date", fieldName),
      this.incrementCount(
        userId,
        this.getCurrentHourString(),
        "hour",
        fieldName,
      ),
    ]);
  }

  canSendMessage(userId: string): Promise<RateLimitResult> {
    return this.check(
      userId,
      "messageCount",
      RATE_LIMITS.MAX_MESSAGES_PER_DAY,
      RATE_LIMITS.MAX_MESSAGES_PER_HOUR,
      "messages",
    );
  }

  async incrementMessageCount(userId: string): Promise<void> {
    await this.increment(userId, "messageCount");
  }

  canSearchBooks(userId: string): Promise<RateLimitResult> {
    return this.check(
      userId,
      "bookSearchCount",
      RATE_LIMITS.MAX_BOOK_SEARCHES_PER_DAY,
      RATE_LIMITS.MAX_BOOK_SEARCHES_PER_HOUR,
      "book searches",
    );
  }

  async incrementBookSearchCount(userId: string): Promise<void> {
    await this.increment(userId, "bookSearchCount");
  }
}

export const rateLimitService = new RateLimitService();
