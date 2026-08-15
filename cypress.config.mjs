import { defineConfig } from "cypress";
import { registerTasks } from "./cypress/support/tasks.mjs";

// E2E suite for the NovelSync core journey. Runs against the full local stack
// brought up by scripts/e2e-stack.sh: Firebase emulators (Firestore 8080, Auth
// 9099, Functions 5001), the Python agent (8000), and creditProxy (mock LLM,
// 8090). The app is served by the Vite dev server in development mode so the
// Firebase Web SDK wires itself to the emulators (see src/config/firebase.ts).
//
// This is a .mjs config (not .ts): the app package is "type": "module", and
// Cypress's ts-node config loader emits CommonJS, which fails to load as ESM
// ("exports is not defined"). Browser-side support/specs stay TypeScript —
// Cypress bundles those with its own preprocessor.
const PROJECT_ID = "story-6f89f";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    // Desktop width (≥ lg 1024px) so the story workspace renders its desktop
    // layout (e.g. the always-visible character roster) rather than mobile.
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    retries: { runMode: 2, openMode: 0 },
    env: {
      projectId: PROJECT_ID,
      firestoreRest: `http://localhost:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      firestoreEmulatorRest: `http://localhost:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      authRest: "http://localhost:9099/identitytoolkit.googleapis.com/v1",
      authEmulatorRest: `http://localhost:9099/emulator/v1/projects/${PROJECT_ID}`,
      functionsBase: `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`,
      agentUrl: "http://127.0.0.1:8000",
      creditProxyUrl: "http://127.0.0.1:8090",
      storyDataUrl: "http://127.0.0.1:8084",
    },
    setupNodeEvents(on) {
      registerTasks(on);
    },
  },
});
