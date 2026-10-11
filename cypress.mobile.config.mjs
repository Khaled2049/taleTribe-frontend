import { defineConfig } from "cypress";

// The mobile app's spec, kept out of the main suite on purpose. That suite's
// support file resets the Auth and Firestore emulators before every test; this
// config loads no support file and registers no tasks, so a run against a dev
// stack cannot wipe it. Needs `yarn mobile:dev` (port 5174) and ./dev-new.sh.
export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5174",
    specPattern: "cypress/mobile/**/*.cy.ts",
    supportFile: false,
    defaultCommandTimeout: 15000,
    video: false,
    retries: 0,
  },
});
