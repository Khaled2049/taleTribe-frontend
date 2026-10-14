#!/usr/bin/env node

/**
 * Set or remove Firebase custom admin claim for a user.
 *
 * Usage:
 *   npm run set-admin -- user@example.com
 *   npm run set-admin -- user@example.com --revoke
 *   npm run set-admin -- user@example.com --prod
 *
 * Defaults to Auth Emulator unless --prod is provided.
 */

const admin = require('firebase-admin')
const { getAuth } = require('firebase-admin/auth')

function parseArgs(argv) {
  const args = argv.slice(2)
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const values = args.filter((a) => !a.startsWith('--'))

  const email = values[0]
  const revoke = flags.has('--revoke')
  const prod = flags.has('--prod')
  const help = flags.has('--help') || flags.has('-h')
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'story-6f89f'

  return { email, revoke, prod, help, projectId }
}

function assertEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required. Example: npm run set-admin -- user@example.com')
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
  npm run set-admin -- <email> [--prod]
  npm run unset-admin -- <email> [--prod]

Options:
  --prod   Use production Auth instead of emulator
  --help   Show this message`)
    return
  }

  assertEmail(email)

  if (!prod) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
  }

  admin.initializeApp({ projectId })

  const user = await getAuth().getUserByEmail(email)
  const existingClaims = user.customClaims || {}
  const nextClaims = { ...existingClaims }

  if (revoke) {
    delete nextClaims.admin
  } else {
    nextClaims.admin = true
  }

  await getAuth().setCustomUserClaims(user.uid, nextClaims)

  console.log(
    JSON.stringify(
      {
        success: true,
        email,
        uid: user.uid,
        admin: !!nextClaims.admin,
        target: prod ? 'production' : 'emulator',
        message: 'Done. User must sign out/sign in to refresh token claims.',
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
