#!/usr/bin/env node

/**
 * Import story JSON payloads through the createStoryByAdmin HTTP function.
 *
 * Usage:
 *   npm run seed-story -- story-ideas/fantasy/mist-and-ash.json
 *   npm run seed-story -- story-ideas                       # every *.json below the dir
 *   npm run seed-story -- story-ideas --key-suffix=run2     # re-import past idempotency
 *   npm run seed-story -- story-ideas/ya --dry-run          # validate only, no request
 *   npm run seed-story -- payload.json --prod --owner-uid=abc123
 *
 * Emulator is the default target. There it will, if needed, create the admin
 * identity (with the `admin` claim) and the owner account + profile for you.
 * With --prod nothing is created: the admin user must already carry the claim
 * and --owner-uid is required.
 *
 * Options:
 *   --admin-email=<email>  Identity to authenticate as (default admin@taletribe.local)
 *   --owner-email=<email>  Owner account to seed/resolve (default seed-owner@taletribe.local)
 *   --owner-uid=<uid>      Use this uid as ownerUid instead of resolving by email
 *   --key-suffix=<text>    Appended to each payload's idempotencyKey
 *   --publish              Force story.isPublished = true
 *   --unpublish            Force story.isPublished = false
 *   --url=<url>            Override the function URL
 *   --project=<id>         Firebase project id (default story-6f89f)
 *   --dry-run              Validate payloads locally (needs `npm run build`) and stop
 *   --prod                 Target production instead of the emulators
 *   --help                 Show this message
 */

const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')

const DEFAULT_PROJECT = 'story-6f89f'
const DEFAULT_ADMIN_EMAIL = 'admin@taletribe.local'
const DEFAULT_OWNER_EMAIL = 'seed-owner@taletribe.local'
const AUTH_EMULATOR_HOST = '127.0.0.1:9099'
const FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
const FUNCTIONS_EMULATOR_ORIGIN = 'http://127.0.0.1:5001'
const REGION = 'us-central1'

function parseArgs(argv) {
  const args = argv.slice(2)
  const flags = new Map()
  const positionals = []

  for (const arg of args) {
    if (!arg.startsWith('--')) {
      positionals.push(arg)
      continue
    }
    const [name, ...rest] = arg.slice(2).split('=')
    flags.set(name, rest.length ? rest.join('=') : true)
  }

  return {
    targets: positionals,
    adminEmail: flags.get('admin-email') || process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
    ownerEmail: flags.get('owner-email') || process.env.SEED_OWNER_EMAIL || DEFAULT_OWNER_EMAIL,
    ownerUid: flags.get('owner-uid') || '',
    keySuffix: flags.get('key-suffix') || '',
    publish: flags.has('publish') ? true : flags.has('unpublish') ? false : null,
    url: flags.get('url') || '',
    projectId: flags.get('project') || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT,
    dryRun: flags.has('dry-run'),
    prod: flags.has('prod'),
    help: flags.has('help') || flags.has('h'),
  }
}

function collectPayloadFiles(targets) {
  const files = []

  const walk = (target) => {
    const resolved = path.resolve(target)
    if (!fs.existsSync(resolved)) {
      throw new Error(`Path not found: ${target}`)
    }
    if (fs.statSync(resolved).isDirectory()) {
      for (const entry of fs.readdirSync(resolved).sort()) {
        walk(path.join(resolved, entry))
      }
      return
    }
    if (resolved.endsWith('.json')) {
      files.push(resolved)
    }
  }

  targets.forEach(walk)
  if (files.length === 0) {
    throw new Error('No .json payloads found in the given path(s)')
  }
  return files
}

function loadPayload(file, options) {
  let payload
  try {
    payload = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`${path.basename(file)}: invalid JSON — ${error.message}`)
  }

  if (options.ownerUid) {
    payload.ownerUid = options.ownerUid
  }
  if (options.keySuffix) {
    payload.idempotencyKey = `${payload.idempotencyKey}-${options.keySuffix}`
  }
  if (options.publish !== null && payload.story) {
    payload.story.isPublished = options.publish
  }
  return payload
}

/** Validate with the same zod schema the function uses (requires a build). */
function loadSchema() {
  try {
    return require('../lib/adminStorySchemas').createStoryByAdminSchema
  } catch {
    return null
  }
}

async function ensureAdminIdentity({ email, prod }) {
  let user
  try {
    user = await admin.auth().getUserByEmail(email)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    if (prod) {
      throw new Error(`Admin user ${email} does not exist in production`)
    }
    user = await admin.auth().createUser({ email, emailVerified: true, displayName: 'seed-admin' })
    console.log(`  created admin user ${email} (${user.uid})`)
  }

  if (!user.customClaims?.admin) {
    if (prod) {
      throw new Error(`User ${email} is missing the admin claim (run: npm run set-admin -- ${email} --prod)`)
    }
    await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true })
    console.log(`  granted admin claim to ${email}`)
  }
  return user
}

/** Resolve (and in the emulator create) the account stories will be attributed to. */
async function ensureOwner({ email, prod }) {
  const db = admin.firestore()

  let user
  try {
    user = await admin.auth().getUserByEmail(email)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    if (prod) {
      throw new Error(`Owner ${email} does not exist — pass --owner-uid for production`)
    }
    user = await admin.auth().createUser({ email, emailVerified: true, displayName: 'seed-owner' })
    console.log(`  created owner user ${email} (${user.uid})`)
  }

  const userRef = db.collection('users').doc(user.uid)
  const snapshot = await userRef.get()
  const username = snapshot.data()?.username

  if (typeof username === 'string' && username.trim()) {
    return user.uid
  }
  if (prod) {
    throw new Error(`Owner ${email} has no users/${user.uid} profile with a username`)
  }

  const generated = `seed_owner_${user.uid.slice(0, 6).toLowerCase()}`
  const nowIso = new Date().toISOString()
  await db.collection('usernames').doc(generated).set({ uid: user.uid })
  await userRef.set(
    {
      username: generated,
      email,
      createdAt: nowIso,
      lastLogin: nowIso,
      followers: [],
      following: [],
      stories: [],
      posts: [],
      likedPosts: [],
      savedPosts: [],
      isAnonymous: false,
      aiUsage: 0,
      lastAiUsageDate: nowIso.split('T')[0],
      bio: 'Seeded story owner',
      occupation: '',
      location: '',
      updatedAt: nowIso,
    },
    { merge: true },
  )
  await db.collection('publicProfiles').doc(user.uid).set(
    { username: generated, bio: 'Seeded story owner', createdAt: nowIso, updatedAt: nowIso },
    { merge: true },
  )
  console.log(`  seeded owner profile users/${user.uid} (${generated})`)
  return user.uid
}

/** Exchange a custom token for an ID token so the function sees a real bearer token. */
async function mintIdToken({ uid, prod, projectId }) {
  const customToken = await admin.auth().createCustomToken(uid)
  const apiKey = prod
    ? process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY
    : 'emulator-key'

  if (prod && !apiKey) {
    throw new Error('Set FIREBASE_API_KEY (web API key) to mint an ID token against production')
  }

  const endpoint = prod
    ? `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`
    : `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true, tenantId: undefined }),
  })
  const body = await response.json()
  if (!response.ok || !body.idToken) {
    throw new Error(`Failed to mint ID token for project ${projectId}: ${JSON.stringify(body)}`)
  }
  return body.idToken
}

function resolveUrl({ url, prod, projectId }) {
  if (url) return url
  return prod
    ? `https://${REGION}-${projectId}.cloudfunctions.net/createStoryByAdmin`
    : `${FUNCTIONS_EMULATOR_ORIGIN}/${projectId}/${REGION}/createStoryByAdmin`
}

async function postPayload({ url, idToken, payload }) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 500) }
  }
  return { status: response.status, body }
}

async function main() {
  const options = parseArgs(process.argv)

  if (options.help || options.targets.length === 0) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('/**')[1].replace(/^ \* ?/gm, ''))
    return
  }

  const files = collectPayloadFiles(options.targets)
  const target = options.prod ? 'production' : 'emulator'
  console.log(`Importing ${files.length} payload(s) into ${target} (project ${options.projectId})`)

  if (options.dryRun) {
    const schema = loadSchema()
    if (!schema) {
      throw new Error('Run `npm run build` first — --dry-run validates against lib/adminStorySchemas.js')
    }
    let failed = 0
    for (const file of files) {
      const payload = loadPayload(file, options)
      const parsed = schema.safeParse(payload)
      if (parsed.success) {
        console.log(`  ok    ${path.relative(process.cwd(), file)}`)
      } else {
        failed += 1
        console.log(`  FAIL  ${path.relative(process.cwd(), file)}`)
        for (const issue of parsed.error.issues) {
          console.log(`        ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        }
      }
    }
    if (failed > 0) process.exitCode = 1
    return
  }

  if (!options.prod) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || AUTH_EMULATOR_HOST
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || FIRESTORE_EMULATOR_HOST
  }
  admin.initializeApp({ projectId: options.projectId })

  const adminUser = await ensureAdminIdentity({ email: options.adminEmail, prod: options.prod })
  const ownerUid = options.ownerUid || (await ensureOwner({ email: options.ownerEmail, prod: options.prod }))
  const idToken = await mintIdToken({ uid: adminUser.uid, prod: options.prod, projectId: options.projectId })
  const url = resolveUrl(options)
  console.log(`  admin ${options.adminEmail} (${adminUser.uid})`)
  console.log(`  owner ${ownerUid}`)
  console.log(`  POST  ${url}\n`)

  let failed = 0
  for (const file of files) {
    const label = path.relative(process.cwd(), file)
    const payload = loadPayload(file, { ...options, ownerUid })
    const { status, body } = await postPayload({ url, idToken, payload })

    if (status === 200 || status === 201) {
      const replay = body.idempotentReplay ? ' (idempotent replay)' : ''
      console.log(`  ${status} ${label} -> ${body.storyId} "${body.title}" ${body.chapterCount}ch${replay}`)
    } else {
      failed += 1
      console.log(`  ${status} ${label} -> ${body.code || 'error'}: ${body.error || JSON.stringify(body)}`)
      for (const issue of body.issues || []) {
        console.log(`        ${issue.path || '(root)'}: ${issue.message}`)
      }
    }
  }

  console.log(`\nDone. ${files.length - failed} succeeded, ${failed} failed.`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
