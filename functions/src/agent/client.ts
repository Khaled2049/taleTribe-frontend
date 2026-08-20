/**
 * The two ways Functions call the Python agent.
 *
 * `callAgent` is the generation path (`POST /agent/execute`, 5-minute ceiling,
 * verbose logging because an LLM call is the expensive thing in the request).
 * `callAgentPath` is for the cheap non-generation endpoints — credit balance and
 * top-up — and holds a 30-second timeout for that reason.
 *
 * Retries live in `agentRetry.ts`; nothing outside it should call `callAgent`.
 */
import * as logger from "firebase-functions/logger";
import { ProviderConfig } from "../domain/aiSettings";
import {
  FetchError,
  agentHeaders,
  connectionRefusedHelp,
  getAgentServiceUrl,
  getIdentityToken,
  isLocalDevelopment,
  parseAgentError,
} from "./transport";

const GENERATION_TIMEOUT_MS = 300_000;
const UTILITY_TIMEOUT_MS = 30_000;

export interface AgentRequest {
  action: string;
  parameters: Record<string, unknown>;
  user_id?: string;
  provider_config?: ProviderConfig;
}

export interface AgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  errorCode?: string;
}

/** POST JSON with the agent's auth headers, throwing FetchError on a non-2xx. */
async function postToAgent(
  url: string,
  body: unknown,
  timeoutMs: number,
  firebaseToken?: string,
): Promise<{ status: number; data: unknown; durationMs: number }> {
  const identityToken = await getIdentityToken();
  // Kept as its own line: a missing token here is the usual cause of a 403 from
  // Cloud Run, and it is otherwise invisible in the logs.
  logger.info(`Identity token obtained: ${identityToken ? "yes" : "no"}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  let rawResponse: Response;
  try {
    rawResponse = await fetch(url, {
      method: "POST",
      headers: agentHeaders(identityToken, firebaseToken),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const durationMs = Date.now() - startTime;
  const data: unknown = await rawResponse.json().catch(() => null);

  if (!rawResponse.ok) {
    throw new FetchError(
      `HTTP ${rawResponse.status} ${rawResponse.statusText}`,
      {
        response: {
          status: rawResponse.status,
          statusText: rawResponse.statusText,
          data,
        },
      },
    );
  }
  return { status: rawResponse.status, data, durationMs };
}

export async function callAgent(
  action: string,
  parameters: Record<string, unknown>,
  userId?: string,
  providerConfig?: ProviderConfig,
  firebaseToken?: string,
): Promise<AgentResponse> {
  const agentUrl = getAgentServiceUrl();
  const target = `${agentUrl}/agent/execute`;
  const request: AgentRequest = {
    action,
    parameters,
    ...(userId && { user_id: userId }),
    ...(providerConfig && { provider_config: providerConfig }),
  };

  logger.info(`Calling agent service: ${action}`, {
    url: target,
    parameters: Object.keys(parameters),
    ai_mode: providerConfig ? `BYOK/${providerConfig.provider}` : "platform",
    model: providerConfig?.model ?? "platform-default",
  });

  try {
    const { status, data, durationMs } = await postToAgent(
      target,
      request,
      GENERATION_TIMEOUT_MS,
      firebaseToken,
    );

    logger.info(`Agent service response received for ${action}`, {
      status,
      hasData: !!data,
      durationMs,
      responseKeys:
        data && typeof data === "object" ? Object.keys(data as object) : [],
    });

    return { success: true, data };
  } catch (error) {
    return failure(error, action, target, agentUrl);
  }
}

export async function callAgentPath(
  path: string,
  body: Record<string, unknown>,
  firebaseToken?: string,
): Promise<AgentResponse> {
  const agentUrl = getAgentServiceUrl();
  const target = `${agentUrl}${path}`;

  try {
    const { data } = await postToAgent(
      target,
      body,
      UTILITY_TIMEOUT_MS,
      firebaseToken,
    );
    return { success: true, data };
  } catch (error) {
    return failure(error, path, target, agentUrl);
  }
}

/**
 * Turn any thrown value into the `{success:false}` envelope callers expect.
 * `label` is the action or path, used only for log correlation.
 */
function failure(
  error: unknown,
  label: string,
  target: string,
  agentUrl: string,
): AgentResponse {
  if (error instanceof FetchError) {
    const { message: friendlyMessage, code: errorCode } = parseAgentError(error);
    const errorMessage = friendlyMessage ?? error.message;
    const details = {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      url: target,
      isLocalDevelopment,
    };

    if (error.code === "ECONNREFUSED" || errorMessage.includes("ECONNREFUSED")) {
      const help = connectionRefusedHelp(agentUrl);
      logger.error(`Agent service error [${label}]: ${help}`, details);
      return { success: false, error: help };
    }

    logger.error(`Agent service error [${label}]: ${errorMessage}`, details);
    return {
      success: false,
      error:
        friendlyMessage ??
        `${errorMessage}${error.code ? ` (${error.code})` : ""}${
          error.response?.status ? ` [HTTP ${error.response.status}]` : ""
        }`,
      errorCode,
    };
  }

  // Network-level: ECONNREFUSED, ETIMEDOUT, an aborted timeout, etc.
  const networkError = error instanceof Error ? error : new Error(String(error));
  if (networkError.message.includes("ECONNREFUSED")) {
    const help = connectionRefusedHelp(agentUrl);
    logger.error(`Agent service error [${label}]: ${help}`, {
      message: networkError.message,
      url: target,
      isLocalDevelopment,
    });
    return { success: false, error: help };
  }

  logger.error(`Error calling agent service: ${label}`, {
    error: networkError.message,
    url: target,
    isLocalDevelopment,
  });
  return { success: false, error: networkError.message };
}
