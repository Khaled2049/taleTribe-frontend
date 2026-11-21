#!/usr/bin/env node

/**
 * Start the real production signup flow for an email the operator controls.
 * The existing invite trigger sends the magic link; the recipient's signup
 * creates Firebase Auth, users/{uid}, the story-data profile, and the completed
 * invite. This script never handles a password or writes profile data itself.
 */

const admin = require('firebase-admin')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const readline = require('node:readline/promises')

const PROD_PROJECT = 'story-6f89f'
const POLL_MS = 2000
const POLL_LIMIT = 30

function usage() {
  return `Usage: npm run prod-test-user -- <email> --prod [--dry-run]

Creates or approves a pending production invite and sends the normal signup
email. The recipient must follow the link and finish signup to create the user.
Requires Google application default credentials with Firebase Auth read and
Firestore write access to ${PROD_PROJECT}.`
}

function parseArgs(argv) {
  const args = argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) return { help: true }
  if (args.length < 2 || args.length > 3 || !args.includes('--prod') ||
      args.some((arg) => arg.startsWith('--') && !['--prod', '--dry-run'].includes(arg))) {
    throw new Error(usage())
  }
  const emails = args.filter((arg) => !arg.startsWith('--'))
  if (emails.length !== 1) throw new Error(usage())
  const email = emails[0].trim().toLowerCase()
  if (email.length > 320 || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)) {
    throw new Error('Provide one valid email address.')
  }
  return { email, dryRun: args.includes('--dry-run') }
}

function assertProduction() {
  const emulatorVars = [
    'FIREBASE_AUTH_EMULATOR_HOST',
    'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_EMULATOR_HUB',
    'FUNCTIONS_EMULATOR',
  ]
  const active = emulatorVars.filter((name) => process.env[name])
  if (active.length) throw new Error(`Refusing to run with emulator settings: ${active.join(', ')}`)

  for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
    if (process.env[name] && process.env[name] !== PROD_PROJECT) {
      throw new Error(`${name} is ${process.env[name]}; expected ${PROD_PROJECT}`)
    }
  }
}

async function confirm(email) {
  if (!process.stdin.isTTY) throw new Error('An interactive terminal is required for production writes.')
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await prompt.question(`Type ${email} to send a PRODUCTION signup invite: `)
    if (answer.trim() !== email) throw new Error('Confirmation did not match. No changes made.')
  } finally {
    prompt.close()
  }
}

async function assertNoAuthUser(email) {
  try {
    await getAuth().getUserByEmail(email)
    throw new Error(`A Firebase Auth account already exists for ${email}; no invite was changed.`)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
  }
}

async function waitForSend(ref) {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt++) {
    const snapshot = await ref.get()
    if (snapshot.get('status') === 'sent') return true
    if (attempt < POLL_LIMIT - 1) await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  return false
}

async function main() {
  const options = parseArgs(process.argv)
  if (options.help) return console.log(usage())
  assertProduction()

  admin.initializeApp({ projectId: PROD_PROJECT })
  await assertNoAuthUser(options.email)

  const ref = getFirestore().collection('invites').doc(options.email)
  const existing = await ref.get()
  const status = existing.exists ? existing.get('status') : null
  if (existing.exists && existing.get('email') !== options.email) {
    throw new Error('Invite email does not match its document ID; no changes made.')
  }
  if (status !== null && status !== 'pending') {
    throw new Error(`Invite is already ${status} for ${options.email}; no changes made.`)
  }
  if (options.dryRun) {
    console.log(`${PROD_PROJECT}: ${options.email} has no Auth account; invite is ${status || 'absent'}. No changes made.`)
    return
  }

  await confirm(options.email)
  // Recheck immediately before writing in case signup or invite review ran
  // while the operator was at the confirmation prompt.
  await assertNoAuthUser(options.email)
  if (!existing.exists) {
    await ref.create({
      email: options.email,
      status: 'pending',
      requestedAt: FieldValue.serverTimestamp(),
      linkSentCount: 0,
      source: 'prod-test-user-cli',
    })
  }

  await getFirestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    if (snapshot.get('status') !== 'pending' || snapshot.get('email') !== options.email) {
      throw new Error(`Invite changed to ${snapshot.get('status')}; approval was not made.`)
    }
    tx.update(ref, {
      status: 'approved',
      reviewedAt: FieldValue.serverTimestamp(),
      approvedAt: FieldValue.serverTimestamp(),
      reviewedBy: 'prod-test-user-cli',
      approvedBy: 'prod-test-user-cli',
    })
  })

  console.log(`Approved production invite for ${options.email}; waiting for email trigger...`)
  if (await waitForSend(ref)) {
    console.log('Invite sent. Open the email and complete signup to create the test user and profile.')
  } else {
    throw new Error('Invite remains approved after 60 seconds. Check onInviteApproved logs; do not rerun until its state is understood.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
