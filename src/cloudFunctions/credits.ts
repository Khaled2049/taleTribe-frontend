import api, { getApiErrorMessage } from "./index";

export interface CreditBalance {
  availableCredits: number;
}

/**
 * Platform AI credit balance + top-up. The authenticated user is resolved
 * server-side from the Firebase ID token, so these calls take no user id.
 */
class CreditService {
  async getBalance(): Promise<CreditBalance> {
    try {
      const { data } = await api.get<CreditBalance>("/getCreditBalance");
      return data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Failed to load credit balance"));
    }
  }

  async purchaseCredits(credits: number): Promise<CreditBalance> {
    try {
      const { data } = await api.post<CreditBalance>("/purchaseCredits", {
        credits,
      });
      return data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Failed to purchase credits"));
    }
  }
}

export const creditService = new CreditService();
