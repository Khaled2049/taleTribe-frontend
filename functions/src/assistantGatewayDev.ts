/** Dedicated local assistant gateway harness. Never deployed as a server. */
import express from "express";
import * as admin from "firebase-admin";
import { handleAssistantRun } from "./endpoints/assistantRun";
import { assistantFlags } from "./domain/assistantFlags";

if (
  !assistantFlags().api ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  process.env.ENVIRONMENT === "production"
) {
  throw new Error(
    "Assistant gateway harness requires the API flag and Firebase Auth emulator",
  );
}
admin.initializeApp({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "story-6f89f",
});
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4kb" }));
app.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: "assistant-run" });
});
app.post("/assistantRun", handleAssistantRun);
// No direct browser CORS: Vite exposes this through a first-party proxy path.
app.listen(5002, "127.0.0.1", () => {
  console.info("Assistant run gateway listening on 127.0.0.1:5002");
});
