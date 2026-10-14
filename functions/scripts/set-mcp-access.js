#!/usr/bin/env node

/**
 * Grant or revoke a user's access to the MCP server.
 *
 * Usage:
 *   npm run grant-mcp  -- user@example.com
 *   npm run revoke-mcp -- user@example.com
 *   npm run grant-mcp  -- user@example.com --prod
 *
 * Defaults to the emulators unless --prod is provided.
 *
 * This writes mcpAccess/{uid}.status in Firestore rather than setting a
 * Firebase custom claim. The agents service checks that document at consent
 * time AND on every MCP tool call, which is what makes a revoke take effect
 * within seconds instead of whenever the user's 30-day OAuth token expires.
 * A custom claim could only be read at consent (the agents service has no
 * firebase-admin) and would also need the user to re-authenticate.
 *
 * Revoking does NOT delete the record — it sets status to "revoked", which
 * reads identically to "absent" for access purposes but preserves the history
 * of who asked and when.
 */

const admin = require('firebase-admin')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

const STATUS_GRANTED = 'granted'
const STATUS_REVOKED = 'revoked'

function parseArgs(argv) {
  const args = argv.slice(2)
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const values = args.filter((a) => !a.startsWith('--'))

  return {
    email: values[0],
    revoke: flags.has('--revoke'),
    prod: flags.has('--prod'),
    help: flags.has('--help') || flags.has('-h'),
    projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'story-6f89f',
  }
}

function assertEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required. Example: npm run grant-mcp -- user@example.com')
  }
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!pattern.test(email)) {
    throw new Error(`Invalid email: ${email}`)
  }
}

async function main() {
  const { email, revoke, prod, help, projectId } = parseArgs(process.argv)

  if (help) {
    console.log(`Usage:
  npm run grant-mcp  -- <email> [--prod]
  npm run revoke-mcp -- <email> [--prod]

Options:
  --prod   Use production Firebase instead of the emulators
  --help   Show this message`)
    return
  }

  assertEmail(email)

  if (!prod) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
  }

  admin.initializeApp({ projectId })

  // Resolve the uid from Auth rather than trusting anything the requester
  // wrote: the request document deliberately carries no email field.
  const user = await getAuth().getUserByEmail(email)
  const db = getFirestore()
  const ref = db.collection('mcpAccess').doc(user.uid)
  const before = (await ref.get()).data() || {}

  const status = revoke ? STATUS_REVOKED : STATUS_GRANTED
  await ref.set(
    {
      status,
      decidedAt: FieldValue.serverTimestamp(),
      requestedAt: before.requestedAt || null,
    },
    { merge: true },
  )

  console.log(
    JSON.stringify(
      {
        success: true,
        email,
        uid: user.uid,
        previousStatus: before.status || null,
        status,
        target: prod ? 'production' : 'emulator',
        message: revoke
          ? 'Revoked. Existing MCP connections stop working within the access cache TTL (default 60s).'
          : 'Granted. Takes effect within seconds — a recent refusal is cached ' +
            'briefly (default 10s) — and no sign-out is required.',
      },
      null,
      2,
    ),
  )
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
  )
  process.exit(1)
})
