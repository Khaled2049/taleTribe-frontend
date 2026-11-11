import api from "./index";

export type WizardEnhanceType =
  "premise" | "character" | "place" | "conflict" | "blueprint";

export interface WizardEnhanceRequest {
  type: WizardEnhanceType;
  data: Record<string, unknown>;
}

export interface BlueprintResult {
  premise?: string;
  characters?: {
    name: string;
    description: string;
    personality?: string;
    backstory?: string;
  }[];
  places?: {
    name: string;
    description: string;
    atmosphere?: string;
    history?: string;
  }[];
  conflict?: string;
}

export interface WizardEnhanceResponse {
  success: boolean;
  data?: {
    /** Single enhanced string — returned for premise/character/place/conflict types */
    enhanced?: string;
    /** Full enriched blueprint — returned for blueprint type */
    blueprint?: BlueprintResult;
  };
  error?: string;
}

export const enhanceWizardInput = async (
  request: WizardEnhanceRequest,
): Promise<WizardEnhanceResponse> => {
  const response = await api.post<WizardEnhanceResponse>(
    "/enhanceWizardInput",
    request,
  );
  return response.data;
};
