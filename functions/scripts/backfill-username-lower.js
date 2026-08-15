#!/usr/bin/env node

/**
 * Backfill `usernameLower` onto publicProfiles, and clear the stray
 * `displayName` an earlier backfill wrote.
 *
 * `usernameLower` is the search key for the people directory. Firestore range
 * queries skip documents missing the ordered field entirely — silently, with no
 * error — so this must run BEFORE the rules open `list` on publicProfiles, or
 * search returns partial results that look like a working feature.
 *
 * `displayName` was never in the rules' allowed key set. Because profile writes
 * are merges, the rule sees the whole resulting document, so any profile
 * carrying that field can no longer be updated by its own owner. Removing it
 * unlocks those accounts.
 *
 * Usage:
 *   node functions/scripts/backfill-username-lower.js
 *   node functions/scripts/backfill-username-lower.js --prod
 *
 * Defaults to Firestore emulator unless --prod is provided. Idempotent.
 */

const admin = require('firebase-admin')

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

async function main() {
  const { prod, help, projectId } = parseArgs(process.argv)

  if (help) {
    console.log(`Usage:
  node functions/scripts/backfill-username-lower.js [--prod]

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
  const profilesSnap = await db.collection('publicProfiles').get()

  let processed = 0
  let written = 0
  let skipped = 0
  let displayNameCleared = 0

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

  for (const profileDoc of profilesSnap.docs) {
    processed += 1
    const data = profileDoc.data() || {}
    const username = typeof data.username === 'string' ? data.username.trim() : ''

    if (!username) {
      skipped += 1
      continue
    }

    const expected = username.toLowerCase()
    const needsLower = data.usernameLower !== expected
    const needsDisplayNameRemoval = data.displayName !== undefined

    if (!needsLower && !needsDisplayNameRemoval) {
      skipped += 1
      continue
    }

    const payload = {}
    if (needsLower) payload.usernameLower = expected
    if (needsDisplayNameRemoval) {
      payload.displayName = admin.firestore.FieldValue.delete()
      displayNameCleared += 1
    }

    batch.set(profileDoc.ref, payload, { merge: true })
    written += 1
    pending += 1

    if (pending >= BATCH_LIMIT) await flush()
  }

  await flush()

  console.log(
    JSON.stringify(
      { processed, written, skipped, displayNameCleared, prod: Boolean(prod) },
      null,
      2,
    ),
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
