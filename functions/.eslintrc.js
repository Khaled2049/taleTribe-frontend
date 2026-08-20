module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    // Resolve those project paths against this directory, not the caller's cwd.
    // The root `yarn lint` runs `eslint .` from the repo root, where a bare
    // "tsconfig.dev.json" does not exist — without this every file below
    // functions/ fails to parse.
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    quotes: ["error", "double"],
    "import/no-unresolved": 0,
    indent: ["error", 2],
    // Disable linebreak-style to allow both LF and CRLF (Windows compatibility)
    "linebreak-style": "off",
    // Allow spaces in object destructuring (Prettier-friendly)
    "object-curly-spacing": ["error", "always"],
    // Relax JSDoc requirements
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    // Relax max-len (Prettier handles line length)
    "max-len": ["error", { code: 120, ignoreUrls: true, ignoreStrings: true }],
    // Allow operator-linebreak flexibility (Prettier handles this)
    "operator-linebreak": "off",
    // Allow any type (warnings only, not errors)
    "@typescript-eslint/no-explicit-any": "warn",
  },
};
