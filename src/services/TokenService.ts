import { doc } from "firebase/firestore";
import api, { getApiErrorMessage } from "@/api";
import { firestore } from "@/config/firebase";
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
  /** Account id for a user. Mirrors `userAccount` in functions/src/ledger.ts. */
  accountIdFor(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * Document ref for the materialized balance, for realtime subscriptions.
   * Readable only by its owner (see the tokenAccounts rule in firestore.rules).
   */
  getAccountRef(userId: string) {
    return doc(firestore, "tokenAccounts", this.accountIdFor(userId));
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
      const { data } = await api.get<ITokenBalance>("/getTokenBalance");
      return data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Failed to load your balance"));
    }
  }

  /** Claim the once-daily faucet. Throws with the server's message on 429. */
  async claimFaucet(): Promise<ITokenBalance & { granted: MinorUnits }> {
    try {
      const { data } = await api.post<ITokenBalance & { granted: MinorUnits }>(
        "/claimTokenFaucet",
        {},
      );
      return data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Failed to claim tokens"));
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
