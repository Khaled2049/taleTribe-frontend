import typography from "@tailwindcss/typography";
import scrollbar from "tailwind-scrollbar";
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy tokens (keep for backward compat with existing components)
        "light-green": "var(--ns-accent)",
        "dark-green": "var(--ns-accent-deep)",

        // Inkwell design system — semantic tokens
        ns: {
          bg: "var(--ns-bg)",
          surface: "var(--ns-surface)",
          "surface-hover": "var(--ns-surface-hover)",
          elevated: "var(--ns-elevated)",
          ink: "var(--ns-ink)",
          "ink-secondary": "var(--ns-ink-secondary)",
          "ink-muted": "var(--ns-ink-muted)",
          accent: "var(--ns-accent)",
          "accent-hover": "var(--ns-accent-hover)",
          "accent-deep": "var(--ns-accent-deep)",
          "accent-subtle": "var(--ns-accent-subtle)",
          gold: "var(--ns-gold)",
          "gold-bright": "var(--ns-gold-bright)",
          teal: "var(--ns-teal)",
          "teal-border": "var(--ns-teal-border)",
          "teal-subtle": "var(--ns-teal-subtle)",
          border: "var(--ns-border)",
          "border-strong": "var(--ns-border-strong)",
          destructive: "var(--ns-destructive)",
          "destructive-hover": "var(--ns-destructive-hover)",
          success: "var(--ns-success)",
        },
      },
      fontFamily: {
        heading: ["Cormorant", "serif"],
        body: ["Crimson Pro", "Georgia", "serif"],
        ui: ["Hanken Grotesk", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["4.5rem", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "300" }],
        "display-lg": ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.015em", fontWeight: "400" }],
        "display": ["2.75rem", { lineHeight: "1.15", letterSpacing: "-0.01em", fontWeight: "400" }],
        "title-lg": ["2rem", { lineHeight: "1.2", letterSpacing: "-0.005em", fontWeight: "500" }],
        "title": ["1.5rem", { lineHeight: "1.3", letterSpacing: "0", fontWeight: "500" }],
        "body-lg": ["1.125rem", { lineHeight: "1.7", fontWeight: "400" }],
        "body": ["1rem", { lineHeight: "1.7", fontWeight: "400" }],
        "body-sm": ["0.875rem", { lineHeight: "1.6", fontWeight: "400" }],
        "caption": ["0.75rem", { lineHeight: "1.5", letterSpacing: "0.02em", fontWeight: "500" }],
        "overline": ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.1em", fontWeight: "600", textTransform: "uppercase" }],
      },
      boxShadow: {
        "ns-sm": "0 1px 3px var(--ns-shadow), 0 1px 2px var(--ns-shadow)",
        "ns": "0 2px 8px var(--ns-shadow), 0 4px 16px var(--ns-shadow-strong)",
        "ns-lg": "0 4px 16px var(--ns-shadow), 0 12px 40px var(--ns-shadow-strong)",
        "ns-xl": "0 8px 30px var(--ns-shadow), 0 20px 60px var(--ns-shadow-strong)",
        "ns-inner": "inset 0 1px 3px var(--ns-shadow)",
        "ns-glow": "0 0 20px var(--ns-accent-glow), 0 0 40px var(--ns-accent-glow)",
      },
      borderRadius: {
        "ns": "0.5rem",
        "ns-lg": "0.75rem",
        "ns-xl": "1rem",
        "ns-2xl": "1.25rem",
      },
      backgroundImage: {
        "grain": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
        "ns-gradient": "linear-gradient(135deg, var(--ns-accent) 0%, var(--ns-accent-deep) 100%)",
        "ns-gradient-gold": "linear-gradient(135deg, var(--ns-gold) 0%, var(--ns-gold-bright) 100%)",
        "ns-gradient-surface": "linear-gradient(180deg, var(--ns-bg) 0%, var(--ns-surface) 100%)",
      },
      animation: {
        "ns-fade-in": "nsFadeIn 0.5s ease-out forwards",
        "ns-slide-up": "nsSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "ns-slide-down": "nsSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "ns-scale-in": "nsScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "ns-glow-pulse": "nsGlowPulse 3s ease-in-out infinite",
        "ns-ink-spread": "nsInkSpread 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        nsFadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        nsSlideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        nsSlideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        nsScaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        nsGlowPulse: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        nsInkSpread: {
          "0%": { transform: "scale(0)", opacity: "0.5" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
      },
      transitionTimingFunction: {
        "ns-spring": "cubic-bezier(0.16, 1, 0.3, 1)",
        "ns-smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [
    typography,
    scrollbar,
    animate,
  ],
};
