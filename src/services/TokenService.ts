import { request } from "@novelsync/story-data-client";
import {
  TALE_ASSET_ID,
  TALE_DECIMALS,
  TALE_SYMBOL,
  type ITokenBalance,
  type MinorUnits,
} from "@/types/IToken";

/**
 * TALE balance access.
 *
 * Balances are never written from the client — every mutation runs in a Cloud
 * Function against the double-entry ledger. This service reads, and asks the
 * server to grant.
 */
export class TokenService {
  /** Account id for a user. */
  accountIdFor(userId: string): string {
    return `user:${userId}`;
  }

  private request<T>(path: string, method = "GET"): Promise<T> {
    return request<T>(path, {
      method,
      auth: "required",
      label: "Token request",
    });
  }

  /**
   * Fetch the balance via the API rather than Firestore.
   *
   * This is deliberate: the endpoint materializes the free starting grant on
   * first touch, so a brand-new user has no `tokenAccounts` document to read
   * yet. Call this once to seed, then let the snapshot listener take over.
   */
  async getBalance(): Promise<ITokenBalance> {
    try {
      return this.request<ITokenBalance>("/v1/me/token-balance");
    } catch (error) {
      throw error;
    }
  }

  /** Claim the once-daily faucet. Throws with the server's message on 429. */
  async claimFaucet(): Promise<ITokenBalance & { granted: MinorUnits }> {
    try {
      return this.request<ITokenBalance & { granted: MinorUnits }>(
        "/v1/me/token-faucet",
        "POST",
      );
    } catch (error) {
      throw error;
    }
  }

  /** Zero balance for a user with no account document yet. */
  emptyBalance(userId: string): ITokenBalance {
    return {
      accountId: this.accountIdFor(userId),
      assetId: TALE_ASSET_ID,
      symbol: TALE_SYMBOL,
      decimals: TALE_DECIMALS,
      balance: "0" as MinorUnits,
    };
  }
}

export const tokenService = new TokenService();
