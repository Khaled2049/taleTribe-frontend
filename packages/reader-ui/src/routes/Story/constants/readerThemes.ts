// src/constants/readerThemes.ts

export const READER_THEMES = {
  light: {
    bg: "bg-white",
    text: "text-black",
    border: "border-gray-200",
    hover: "hover:bg-black/5",
    panel: "bg-white",
  },
  dark: {
    bg: "bg-[#1a1a1a]",
    text: "text-gray-100",
    border: "border-gray-700",
    hover: "hover:bg-white/5",
    panel: "bg-gray-800",
  },
  sepia: {
    bg: "bg-[#f4ecd8]",
    text: "text-[#5c4b37]",
    border: "border-[#d4c4a8]",
    hover: "hover:bg-[#5c4b37]/5",
    panel: "bg-[#f4ecd8]",
  },
} as const;

export const READER_FONTS = {
  serif: "Georgia, serif",
  sans: "system-ui, sans-serif",
  mono: "ui-monospace, monospace",
  palatino: "Palatino, serif",
  bookerly: "Charter, Georgia, serif",
} as const;

export const DEFAULT_READER_SETTINGS = {
  fontSize: 18,
  fontFamily: "serif" as const,
  lineHeight: 1.8,
  theme: "light" as const,
  textAlign: "justify" as const,
  // Empty means "whatever the browser reports as its default voice".
  ttsVoice: "",
  ttsSpeed: 1.0,
};

export const HIGHLIGHT_COLORS = {
  yellow: "bg-yellow-200 hover:bg-yellow-300",
  green: "bg-green-200 hover:bg-green-300",
  blue: "bg-blue-200 hover:bg-blue-300",
  pink: "bg-pink-200 hover:bg-pink-300",
} as const;
