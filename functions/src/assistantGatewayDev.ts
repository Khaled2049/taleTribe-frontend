/** Phase 0 dedicated gateway harness. Never deployed as a production server. */
import express from "express";
import * as admin from "firebase-admin";
import { handleAssistantStreamSpike } from "./endpoints/assistantStreamSpike";
import { assistantFlags } from "./domain/assistantFlags";

if (
  !assistantFlags().spike ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.ENVIRONMENT === "production"
) {
  throw new Error(
    "Assistant gateway harness requires explicit emulator and spike configuration",
  );
}
admin.initializeApp({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "story-6f89f",
});
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4kb" }));
app.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: "phase-0-mock" });
});
app.post("/assistantStreamSpike", handleAssistantStreamSpike);
// No direct browser CORS: Vite exposes this through a first-party proxy path.
app.listen(5002, "127.0.0.1", () => {
  console.info("Phase 0 assistant gateway listening on 127.0.0.1:5002");
});
