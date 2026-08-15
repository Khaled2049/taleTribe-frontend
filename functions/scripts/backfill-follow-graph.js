#!/usr/bin/env node

/**
 * Strip the literal "default" placeholder from users' `followers`/`following`.
 *
 * Older signup paths seeded both arrays with the string "default". It matches no
 * uid, so it never granted anyone access, but it inflates counts and renders as
 * a ghost row. A user cannot remove it themselves: the rules forbid self-writes
 * to `followers`, so only the Admin SDK can clear it.
 *
 * The client also filters it on read (`realUids` in src/stores/authStore.ts), so
 * this script is a cleanup rather than a prerequisite — both shapes are tolerated
 * during the rollout window.
 *
 * Usage:
 *   node functions/scripts/backfill-follow-graph.js
 *   node functions/scripts/backfill-follow-graph.js --prod
 *
 * Defaults to Firestore emulator unless --prod is provided. Idempotent.
 */

const admin = require('firebase-admin')

const PLACEHOLDER = 'default'

function parseArgs(argv) {
  const args = argv.slice(2)
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const projectId =
    process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'story-6f89f'

  return {
    prod: flags.has('--prod'),
    help: flags.has('--help') || flags.has('-h'),
    projectId,
  }
}

const cleaned = (value) =>
  Array.isArray(value)
    ? value.filter((id) => typeof id === 'string' && id !== PLACEHOLDER)
    : []

async function main() {
  const { prod, help, projectId } = parseArgs(process.argv)

  if (help) {
    console.log(`Usage:
  node functions/scripts/backfill-follow-graph.js [--prod]

Options:
  --prod   Use production Firestore instead of emulator
  --help   Show this message`)
    return
  }

  if (!prod) {
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
  }

  admin.initializeApp({ projectId })

  const db = admin.firestore()
  const usersSnap = await db.collection('users').get()

  let processed = 0
  let written = 0
  let skipped = 0

  // Firestore caps a batch at 500 writes.
  const BATCH_LIMIT = 400
  let batch = db.batch()
  let pending = 0

  const flush = async () => {
    if (pending === 0) return
    await batch.commit()
    batch = db.batch()
    pending = 0
  }

  for (const userDoc of usersSnap.docs) {
    processed += 1
    const data = userDoc.data() || {}

    const hasPlaceholder =
      (Array.isArray(data.followers) && data.followers.includes(PLACEHOLDER)) ||
      (Array.isArray(data.following) && data.following.includes(PLACEHOLDER))

    if (!hasPlaceholder) {
      skipped += 1
      continue
    }

    batch.set(
      userDoc.ref,
      { followers: cleaned(data.followers), following: cleaned(data.following) },
      { merge: true },
    )
    written += 1
    pending += 1

    if (pending >= BATCH_LIMIT) await flush()
  }

  await flush()

  console.log(
    JSON.stringify({ processed, written, skipped, prod: Boolean(prod) }, null, 2),
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
