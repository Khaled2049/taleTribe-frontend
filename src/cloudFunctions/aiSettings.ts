import api, { getApiErrorMessage } from "./index";

export type AiProvider = "gemini" | "anthropic" | "openai";

export interface AiModelCatalogItem {
  id: string;
  label: string;
  description: string;
  tier: string;
  capabilities: string[];
}

export interface AiProviderCatalogItem {
  id: AiProvider;
  label: string;
  description: string;
  default_model: string;
  models: AiModelCatalogItem[];
}

export interface AiProviderCatalog {
  version: number;
  providers: AiProviderCatalogItem[];
}

export interface AiSettingsSummary {
  active: boolean;
  provider: AiProvider | null;
  model: string | null;
  keyHint: string | null;
  validatedAt: string | null;
}

export interface AiKeyValidation {
  valid: boolean;
  provider?: AiProvider;
  model?: string;
  error?: string;
}

export interface AiSettingsInput {
  provider: AiProvider;
  apiKey?: string;
  model?: string | null;
}

export const getAiProviderCatalog = async (): Promise<AiProviderCatalog> => {
  const { data } = await api.post<AiProviderCatalog>(
    "/getAiProviderCatalog",
    {},
  );
  return data;
};

export const getAiSettings = async (): Promise<AiSettingsSummary> => {
  const { data } = await api.post<AiSettingsSummary>("/getAiSettings", {});
  return data;
};

/** Invalid credentials are an expected result, so validation does not throw. */
export const validateAiKey = async (
  provider: AiProvider,
  apiKey: string,
  model?: string | null,
): Promise<AiKeyValidation> => {
  try {
    const { data } = await api.post<AiKeyValidation>("/validateAiKey", {
      provider,
      apiKey,
      model: model || null,
    });
    return data;
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
