#!/usr/bin/env node

/**
 * List MCP access requests so you can decide who to approve.
 *
 * Usage:
 *   npm run mcp-requests              # pending requests only (emulator)
 *   npm run mcp-requests -- --all     # every record, any status
 *   npm run mcp-requests -- --prod    # production
 *
 * Emails are resolved from Firebase Auth by uid, never read from the request
 * document — a user writes their own request, so anything in it is
 * self-reported and could name someone else.
 */

const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

function parseArgs(argv) {
  const flags = new Set(argv.slice(2).filter((a) => a.startsWith("--")));
  return {
    all: flags.has("--all"),
    prod: flags.has("--prod"),
    help: flags.has("--help") || flags.has("-h"),
    projectId:
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      "story-6f89f",
  };
}

function sanitizeNote(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, 60);
}

function formatTime(value) {
  if (!value) return "—";
  const date =
    typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toISOString().replace("T", " ").slice(0, 16);
}

async function main() {
  const { all, prod, help, projectId } = parseArgs(process.argv);

  if (help) {
    console.log(`Usage:
  npm run mcp-requests -- [--all] [--prod]

Options:
  --all    Show every record, not just pending requests
  --prod   Use production Firebase instead of the emulators
  --help   Show this message`);
    return;
  }

  if (!prod) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  }

  admin.initializeApp({ projectId });
  const db = getFirestore();

  let query = db.collection("mcpAccess");
  if (!all) query = query.where("status", "==", "requested");
  const snap = await query.get();

  if (snap.empty) {
    console.log(
      all ? "No MCP access records." : "No pending MCP access requests.",
    );
    return;
  }

  const rows = await Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data();
      let email = "(no auth record)";
      try {
        email = (await getAuth().getUser(doc.id)).email || "(no email)";
      } catch {
        // User deleted from Auth but the request document survives.
      }
      return {
        email,
        uid: doc.id,
        status: data.status || "—",
        requested: formatTime(data.requestedAt),
        decided: formatTime(data.decidedAt),
        note: sanitizeNote(data.note),
      };
    }),
  );

  rows.sort((a, b) => a.requested.localeCompare(b.requested));
  console.table(rows);
  console.log(
    `\n${rows.length} record(s). Approve with:\n  npm run grant-mcp -- <email>${prod ? " --prod" : ""}`,
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
