module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  ignorePatterns: [
    "dist",
    "**/dist/**",
    ".artifacts",
    ".eslintrc.cjs",
    "cypress",
    "cypress.config.mjs",
    "packages/assistant-contracts/src/generated",
  ],
  overrides: [
    {
      files: [
        "src/main.tsx",
        "src/components/editor/SlashCommandExtension.tsx",
        "src/components/guestbook/PeopleSegments.tsx",
        "packages/reader-ui/src/runtime.tsx",
      ],
      rules: { "react-refresh/only-export-components": "off" },
    },
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["react-hooks", "react-refresh"],
  rules: {
    // react-hooks 7's preset adds the React Compiler rules (74 existing hits);
    // keep the two classic rules until those are worked through.
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    // Underscore bindings intentionally discard API fields and unused arguments.
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
};
