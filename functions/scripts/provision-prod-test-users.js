#!/usr/bin/env node

/** Provision complete production test accounts from local JSON files. */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const readline = require('node:readline/promises')
const admin = require('firebase-admin')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const dotenv = require('dotenv')

const PROJECT = 'story-6f89f'
const PROFILE_FIELDS = [
  'firstName', 'lastName', 'bio', 'occupation', 'location',
  'writingInterests', 'photoURL', 'walletAddress',
]
const ALLOWED_FIELDS = new Set(['email', 'username', ...PROFILE_FIELDS])

function fail(message) { throw new Error(message) }

function loadUsers(directory) {
  const names = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort()
  if (!names.length) fail(`No .json user files found in ${directory}. Copy example.json.example to a .json file first.`)
  if (names.length > 50) fail('Limit each run to 50 users.')
  const emails = new Set()
  const usernames = new Set()
  return names.map((name) => {
    const file = path.join(directory, name)
    if (!fs.statSync(file).isFile()) fail(`${file} must be a regular file.`)
    if (fs.statSync(file).size > 65536) fail(`${file} is too large.`)
    const user = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!user || typeof user !== 'object' || Array.isArray(user)) fail(`${file}: expected an object.`)
    for (const key of Object.keys(user)) {
      if (!ALLOWED_FIELDS.has(key)) fail(`${file}: unknown field ${key}; passwords and claims are not accepted.`)
      if (typeof user[key] !== 'string') fail(`${file}: ${key} must be a string.`)
    }
    const email = (user.email || '').trim().toLowerCase()
    const username = (user.username || '').trim()
    if (email.length > 320 || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)) fail(`${file}: invalid email.`)
    if (email.endsWith('.invalid') || email.endsWith('@example.com') || email.endsWith('@example.org')) {
      fail(`${file}: replace the sample email with an address you control.`)
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) fail(`${file}: username must be 3-20 letters, digits or underscores.`)
    if (emails.has(email) || usernames.has(username.toLowerCase())) fail(`${file}: duplicate email or username in this batch.`)
    emails.add(email)
    usernames.add(username.toLowerCase())
    if (user.photoURL && !/^https:\/\//.test(user.photoURL)) fail(`${file}: photoURL must be HTTPS.`)
    const profile = { username }
    for (const field of PROFILE_FIELDS) profile[field === 'photoURL' ? 'photoUrl' : field] = user[field]?.trim() || ''
    return { email, username, profile, file: name }
  })
}

function productionConfig() {
  for (const name of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_EMULATOR_HUB', 'FUNCTIONS_EMULATOR']) {
    if (process.env[name]) fail(`Refusing emulator setting ${name}.`)
  }
  const configFile = path.resolve(process.cwd(), '.env.desktop-prod')
  const local = fs.existsSync(configFile) ? dotenv.parse(fs.readFileSync(configFile)) : {}
  const project = process.env.TT_FIREBASE_PROJECT_ID || local.TT_FIREBASE_PROJECT_ID || PROJECT
  if (project !== PROJECT) fail(`Firebase project must be ${PROJECT}.`)
  if ((process.env.TT_USE_EMULATORS || local.TT_USE_EMULATORS || '').toLowerCase() === 'true') fail('Production config enables emulators.')
  for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
    if (process.env[name] && process.env[name] !== PROJECT) fail(`${name} points to another project.`)
  }
  const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.TT_FIREBASE_API_KEY || local.TT_FIREBASE_API_KEY
  const baseUrl = process.env.PROD_STORY_DATA_URL || process.env.TT_STORY_DATA_URL || local.TT_STORY_DATA_URL
  if (!apiKey || !baseUrl) fail('Set FIREBASE_WEB_API_KEY and PROD_STORY_DATA_URL, or provide .env.desktop-prod.')
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) {
    fail('Production story-data URL must be a plain HTTPS origin.')
  }
  return { apiKey, baseUrl: url.href.replace(/\/$/, '') }
}

async function confirm(users) {
  if (!process.stdin.isTTY) fail('An interactive terminal is required for production writes.')
  console.log(`PRODUCTION project ${PROJECT}: create ${users.length} test account(s):`)
  for (const user of users) console.log(`  ${user.email} (${user.username})`)
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await prompt.question(`Type CREATE ${users.length} to continue: `)
    if (answer.trim() !== `CREATE ${users.length}`) fail('Confirmation did not match. No changes made.')
  } finally { prompt.close() }
}

async function preflight(users, baseUrl) {
  const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(10000) })
  if (!health.ok) fail(`story-data health check failed (${health.status}). No changes made.`)
  for (const user of users) {
    try {
      await getAuth().getUserByEmail(user.email)
      fail(`${user.email}: Auth account already exists. No changes made.`)
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error
    }
    if ((await getFirestore().collection('invites').doc(user.email).get()).exists) {
      fail(`${user.email}: invite already exists. No changes made.`)
    }
    const query = new URLSearchParams({ query: user.username, limit: '50' })
    const response = await fetch(`${baseUrl}/v1/public/profiles?${query}`, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) fail(`${user.email}: could not check username availability (${response.status}). No changes made.`)
    const page = await response.json()
    if (!Array.isArray(page.profiles)) fail(`${user.email}: invalid profile search response. No changes made.`)
    if (page.profiles.some((profile) => profile.username?.toLowerCase() === user.username.toLowerCase())) {
      fail(`${user.email}: username ${user.username} is already taken. No changes made.`)
    }
  }
}

async function signIn(email, password, apiKey) {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })
  } catch { fail(`${email}: Firebase sign-in request failed.`) }
  const data = await response.json()
  if (!response.ok || !data.idToken) fail(`${email}: Firebase sign-in failed: ${data.error?.message || response.status}`)
  return data.idToken
}

async function createProfile(user, idToken, baseUrl) {
  const response = await fetch(`${baseUrl}/v1/profiles/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(user.profile),
  })
  if (!response.ok) fail(`${user.email}: story-data profile failed (${response.status}): ${(await response.text()).slice(0, 500)}`)
}

function credentialFile(users) {
  // The Makefile passes the workspace's Git-ignored test-users directory, which
  // a path relative to this script cannot find from a worktree.
  const directory = process.env.TEST_USERS_CREDENTIALS_DIR
  if (!directory || !path.isAbsolute(directory)) fail('Run through make prod-test-users; TEST_USERS_CREDENTIALS_DIR must be an absolute path.')
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, `.credentials-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.jsonl`)
  const fd = fs.openSync(file, 'wx', 0o600)
  fs.fchmodSync(fd, 0o600)
  const credentials = users.map((user) => ({
    email: user.email,
    password: `${crypto.randomBytes(32).toString('base64url')}aA0!`,
  }))
  for (const item of credentials) fs.writeSync(fd, `${JSON.stringify({ ...item, status: 'planned' })}\n`)
  fs.fsyncSync(fd)
  return { file, fd, credentials }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: make prod-test-users [DIR=test-users] [DRY_RUN=1]')
    return
  }
  const dryRun = args.includes('--dry-run')
  if (args.length !== (dryRun ? 2 : 1) || args[0]?.startsWith('--')) fail('Usage: make prod-test-users [DIR=test-users] [DRY_RUN=1]')
  const directory = path.resolve(args[0])
  const users = loadUsers(directory)
  if (dryRun) {
    console.log(`Validated ${users.length} user JSON file(s). No production access or writes.`)
    for (const user of users) console.log(`  ${user.file}: ${user.email} (${user.username})`)
    return
  }

  if (!process.env.TEST_USERS_CREDENTIALS_DIR || !path.isAbsolute(process.env.TEST_USERS_CREDENTIALS_DIR)) {
    fail('Run through make prod-test-users; TEST_USERS_CREDENTIALS_DIR must be an absolute path.')
  }
  const config = productionConfig()
  admin.initializeApp({ projectId: PROJECT })
  await preflight(users, config.baseUrl)
  await confirm(users)
  await preflight(users, config.baseUrl)
  const output = credentialFile(users)
  console.log(`Private credentials file: ${output.file}`)
  try {
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      const password = output.credentials[i].password
      const account = await getAuth().createUser({
        email: user.email, password, displayName: user.username, emailVerified: true,
      })
      fs.writeSync(output.fd, `${JSON.stringify({ email: user.email, uid: account.uid, status: 'auth-created' })}\n`)
      fs.fsyncSync(output.fd)
      const idToken = await signIn(user.email, password, config.apiKey)
      await createProfile(user, idToken, config.baseUrl)
      const now = new Date().toISOString()
      await getFirestore().collection('users').doc(account.uid).create({
        email: user.email, createdAt: now, lastLogin: now, isAnonymous: false,
      })
      await getFirestore().collection('invites').doc(user.email).create({
        email: user.email, status: 'completed', requestedAt: FieldValue.serverTimestamp(),
        approvedAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp(),
        linkSentCount: 0, source: 'prod-test-users-cli',
      })
      fs.writeSync(output.fd, `${JSON.stringify({ email: user.email, uid: account.uid, status: 'complete' })}\n`)
      fs.fsyncSync(output.fd)
      console.log(`Created ${user.email} (${account.uid})`)
    }
  } finally { fs.closeSync(output.fd) }
  console.log('All test users created. Keep the credentials file private.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
