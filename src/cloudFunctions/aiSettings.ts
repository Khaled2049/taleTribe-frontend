import api, { getApiErrorMessage } from "./index";

export type AiProvider = "gemini" | "claude" | "openai";

export interface AiKeyValidation {
  valid: boolean;
  error?: string;
}

export interface AiSettingsInput {
  provider: AiProvider;
  apiKey: string;
  model?: string;
}

/**
 * Returns a result instead of throwing: an invalid key is the expected answer
 * here, not an exception, and the caller renders `error` either way. A network
 * failure collapses into the same shape so the form has one path to handle.
 */
export const validateAiKey = async (
  provider: AiProvider,
  apiKey: string,
): Promise<AiKeyValidation> => {
  try {
    const { data } = await api.post<AiKeyValidation>("/validateAiKey", {
      provider,
      apiKey,
    });
    return { valid: data.valid === true, error: data.error };
  } catch (error) {
    return {
      valid: false,
      error: getApiErrorMessage(error, "Key validation failed"),
    };
  }
};

export const saveAiSettings = async (input: AiSettingsInput): Promise<void> => {
  try {
    await api.post("/saveAiSettings", input);
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Failed to save AI settings"));
  }
};

export const deleteAiSettings = async (): Promise<void> => {
  try {
    await api.post("/deleteAiSettings", {});
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Failed to remove AI settings"));
  }
};
