// Shared AI provider / model config used by the Settings page and the
// signup wizard's optional BYOK step.

export type ProviderKey = "gemini" | "anthropic" | "openai";

export interface ProviderMeta {
  label: string;
  description: string;
  accent: string;
  border: string;
  bg: string;
}

export const PROVIDERS: Record<ProviderKey, ProviderMeta> = {
  gemini: {
    label: "Gemini",
    description: "Google's Gemini AI — multimodal, fast",
    accent: "text-blue-500",
    border: "border-blue-500/40",
    bg: "bg-blue-500/5",
  },
  anthropic: {
    label: "Claude",
    description: "Anthropic's Claude — nuanced, literary",
    accent: "text-purple-500",
    border: "border-purple-500/40",
    bg: "bg-purple-500/5",
  },
  openai: {
    label: "OpenAI",
    description: "OpenAI GPT — versatile, widely supported",
    accent: "text-teal-500",
    border: "border-teal-500/40",
    bg: "bg-teal-500/5",
  },
};

export const MODELS: Record<ProviderKey, { value: string; label: string }[]> = {
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash — Fast" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro — Quality" },
  ],
  anthropic: [
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku — Fast" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet — Balanced" },
    { value: "claude-opus-4-7", label: "Claude Opus — Quality" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini — Fast" },
    { value: "gpt-4o", label: "GPT-4o — Quality" },
    { value: "o3-mini", label: "o3-mini — Reasoning" },
  ],
};
