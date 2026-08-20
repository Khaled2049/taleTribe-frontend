/**
 * Retry policy for agent generation calls — the entry point every AI endpoint
 * uses. Wraps `callAgent` with exponential backoff.
 */
import * as logger from "firebase-functions/logger";
import { ProviderConfig } from "../domain/aiSettings";
import { AgentResponse, callAgent } from "./client";

/**
 * Failures a second attempt cannot fix: the caller is out of credits, not
 * allowed, or sent something invalid. Retrying these burns latency and, for
 * billing errors, risks charging twice.
 */
const NON_RETRYABLE_ERROR_CODES = new Set([
  "INSUFFICIENT_CREDITS",
  "UNAUTHORIZED",
  "PROVIDER_NOT_FOUND",
  "INVALID_REQUEST",
  "BILLING_ERROR",
  "VALIDATION_ERROR",
  "BAD_REQUEST",
]);

export async function callAgentWithRetry(
  action: string,
  parameters: Record<string, unknown>,
  maxRetries = 3,
  retryDelay = 1000,
  userId?: string,
  providerConfig?: ProviderConfig,
  firebaseToken?: string,
): Promise<AgentResponse> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await callAgent(
      action,
      parameters,
      userId,
      providerConfig,
      firebaseToken,
    );

    if (result.success) return result;
    if (attempt === maxRetries) return result;
    if (result.errorCode && NON_RETRYABLE_ERROR_CODES.has(result.errorCode)) {
      return result;
    }

    logger.warn(
      `Agent call failed (${action}). Retrying ${attempt}/${maxRetries} in ${retryDelay}ms. Error: ${result.error}`,
    );

    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }

  return { success: false, error: "Max retries exceeded" };
}
