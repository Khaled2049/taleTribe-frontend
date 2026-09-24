module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'cypress', 'cypress.config.mjs', 'packages/assistant-contracts/src/generated'],
  overrides: [{
    files: ['src/main.tsx', 'src/components/editor/SlashCommandExtension.tsx', 'src/components/guestbook/PeopleSegments.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  }],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    // Underscore bindings intentionally discard API fields and unused arguments.
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
