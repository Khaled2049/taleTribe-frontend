#!/usr/bin/env node

/**
 * Import story JSON payloads into story-data.
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
 *   --owner-email=<email>  Owner account to seed/resolve (default seed-owner@taletribe.local)
 *   --owner-uid=<uid>      Use this uid as ownerUid instead of resolving by email
 *   --key-suffix=<text>    Appended to each payload's idempotencyKey
 *   --publish              Force story.isPublished = true
 *   --unpublish            Force story.isPublished = false
 *   --url=<url>            Override the function URL
 *   --project=<id>         Firebase project id (default story-6f89f)
 *   --service-account=<email>  Sign custom tokens as this service account. Needed
 *                          with --prod when your credentials are a gcloud user
 *                          login (those cannot sign JWTs locally); requires
 *                          roles/iam.serviceAccountTokenCreator on it. Not needed
 *                          when GOOGLE_APPLICATION_CREDENTIALS points at a key.
 *   --dry-run              Validate payloads locally (needs `npm run build`) and stop
 *   --prod                 Target production instead of the emulators
 *   --help                 Show this message
 */

const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')

const DEFAULT_PROJECT = 'story-6f89f'
const DEFAULT_OWNER_EMAIL = 'seed-owner@taletribe.local'
const AUTH_EMULATOR_HOST = '127.0.0.1:9099'
const FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'

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
    ownerEmail: flags.get('owner-email') || process.env.SEED_OWNER_EMAIL || DEFAULT_OWNER_EMAIL,
    ownerUid: flags.get('owner-uid') || '',
    keySuffix: flags.get('key-suffix') || '',
    publish: flags.has('publish') ? true : flags.has('unpublish') ? false : null,
    url: flags.get('url') || '',
    serviceAccount: flags.get('service-account') || process.env.FIREBASE_SERVICE_ACCOUNT_ID || '',
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
    return require('../lib/domain/adminStorySchemas').createStoryByAdminSchema
  } catch {
    return null
  }
}

/** Build the seeded profile from the same defaults signup and createUserByAdmin use. */
function loadUserProfileDefaults() {
  try {
    return require('../lib/domain/userProfileDefaults').buildUserProfileDefaults
  } catch {
    throw new Error('Run `npm run build` first — the seeded owner profile reuses lib/domain/userProfileDefaults.js')
  }
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
  const userDoc = loadUserProfileDefaults()({ username: generated, email })

  // Only the user document. story-data owns the public profile (created on the
  // user's first sign-in) and enforces username uniqueness itself via
  // public_profiles.username_lower, so the old Firestore `usernames` index is
  // gone — it had no reader left once createUserByAdmin was removed.
  await userRef.set(userDoc, { merge: true })
  console.log(`  seeded owner profile users/${user.uid} (${generated})`)
  return user.uid
}

/** Exchange a custom token for an ID token so the function sees a real bearer token. */
async function mintIdToken({ uid, prod, projectId }) {
  let customToken
  try {
    customToken = await admin.auth().createCustomToken(uid)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/signBlob|service account/i.test(message)) {
      throw new Error(
        'Cannot sign a custom token — gcloud user credentials have no signing key. Either:\n' +
        '  a) grant yourself roles/iam.serviceAccountTokenCreator on a service account and pass\n' +
        '     --service-account=<sa-email>, or\n' +
        '  b) export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json\n' +
        `Original error: ${message}`,
      )
    }
    throw error
  }
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

function resolveUrl({ url }) {
  return (url || process.env.STORY_DATA_URL || 'http://127.0.0.1:8084').replace(/\/$/, '')
}

/**
 * story-data creates entities for the *caller*, so every request here is made
 * as the story's owner rather than as an admin. The bearer token is what
 * production verifies; X-User-ID is what a local AUTH_MODE=dev instance reads.
 */
async function storyData(baseUrl, ctx, method, path, body, revision) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ctx.idToken}`,
    'X-User-ID': ctx.ownerUid,
  }
  if (revision !== undefined) headers['If-Match'] = String(revision)

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let parsed
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = { raw: text.slice(0, 300) }
  }
  if (!response.ok) {
    const error = new Error(`${method} ${path} -> ${response.status}: ${parsed.error || text.slice(0, 200)}`)
    error.status = response.status
    throw error
  }
  return parsed
}

/**
 * Walk a validated payload into story-data.
 *
 * The payload addresses everything by key (`characterKeys`, `locationKey`,
 * dependency `plotKey`/`eventKey`) because it was written for a Firestore
 * aggregate that could allocate every id up front. story-data assigns ids on
 * insert instead, so entities are created first and the references patched in
 * a second pass — which is also why events are created before their
 * dependencies are attached.
 */
async function importPayload({ baseUrl, ctx, payload }) {
  const call = (method, path, body, revision) => storyData(baseUrl, ctx, method, path, body, revision)

  // Idempotency: the Firestore importer kept an adminStoryImports ledger. Here
  // the owner's own library is the ledger — a re-run finds the title and stops.
  const owned = await call('GET', '/v1/stories')
  const existing = owned.find((story) => story.title === payload.story.title)
  if (existing) {
    return { storyId: existing.id, title: existing.title, chapterCount: null, replay: true }
  }

  const story = await call('POST', '/v1/stories', {
    title: payload.story.title,
    description: payload.story.description,
    authorName: payload.story.authorName || '',
    category: payload.story.category,
    targetAudience: payload.story.targetAudience,
    language: payload.story.language,
    copyright: payload.story.copyright,
    coverImageUrl: payload.story.coverImageUrl,
    thumbnailUrl: payload.story.thumbnailUrl,
    tags: payload.story.tags,
    published: payload.story.isPublished,
  })
  const storyId = story.id

  // Creating a story opens it with an empty first chapter; fill that one in
  // rather than leaving it stranded ahead of the imported prose.
  const [opening] = await call('GET', `/v1/stories/${storyId}/chapters`)
  for (const [index, chapter] of payload.chapters.entries()) {
    if (index === 0 && opening) {
      await call('PATCH', `/v1/stories/${storyId}/chapters/${opening.id}`, {
        title: chapter.title,
        content: chapter.content,
        position: opening.position,
      }, opening.revision)
    } else {
      await call('POST', `/v1/stories/${storyId}/chapters`, {
        title: chapter.title,
        content: chapter.content,
        position: index,
      })
    }
  }

  const characterIds = {}
  for (const character of payload.characters) {
    const created = await call('POST', `/v1/stories/${storyId}/characters`, {
      name: character.name,
      age: character.age ?? null,
      artUrl: character.artUrl || '',
      soul: character.soul || '',
      personality: character.personality || '',
      voice: character.voice || '',
      backstory: character.backstory || '',
      affiliations: character.affiliations || '',
      notes: character.notes || '',
    })
    characterIds[character.key] = created.id
  }

  // Relationships point at other characters, so they can only be attached once
  // every character exists.
  for (const character of payload.characters) {
    const relationships = (character.relationships || []).map((relationship) => ({
      characterId: characterIds[relationship.characterKey],
      type: relationship.type,
      description: relationship.description || '',
    }))
    if (relationships.length === 0) continue
    const current = (await call('GET', `/v1/stories/${storyId}/characters`))
      .find((entry) => entry.id === characterIds[character.key])
    await call('PATCH', `/v1/stories/${storyId}/characters/${characterIds[character.key]}`, {
      name: character.name,
      age: character.age ?? null,
      artUrl: character.artUrl || '',
      soul: character.soul || '',
      personality: character.personality || '',
      voice: character.voice || '',
      backstory: character.backstory || '',
      affiliations: character.affiliations || '',
      notes: character.notes || '',
      relationships,
    }, current.revision)
  }

  const placeIds = {}
  for (const place of payload.places) {
    const created = await call('POST', `/v1/stories/${storyId}/places`, {
      name: place.name,
      imageUrl: place.imageUrl || '',
      description: place.description || '',
      atmosphere: place.atmosphere || '',
      geography: place.geography || '',
      history: place.history || '',
      significance: place.significance || '',
      notes: place.notes || '',
    })
    placeIds[place.key] = created.id
  }

  const plotIds = {}
  const eventIds = {}
  for (const plot of payload.plots) {
    const created = await call('POST', `/v1/stories/${storyId}/plots`, {
      name: plot.name,
      description: plot.description,
    })
    plotIds[plot.key] = created.id

    for (const event of plot.events) {
      const madeEvent = await call('POST', `/v1/stories/${storyId}/plots/${created.id}/events`, {
        name: event.name,
        content: event.content,
        characterIds: (event.characterKeys || []).map((key) => characterIds[key]).filter(Boolean),
        locationId: event.locationKey ? placeIds[event.locationKey] || null : null,
        tensionLevel: event.tensionLevel,
        pacing: event.pacing,
        storyBeat: event.storyBeat,
        emotionalTone: event.emotionalTone || '',
        chapterNumber: event.chapterNumber ?? null,
        notes: event.notes || '',
      })
      eventIds[`${plot.key}::${event.key}`] = madeEvent.id
    }
  }

  // Dependencies may point forward to an event in a later plot line, so they
  // are attached only once every event has an id.
  for (const plot of payload.plots) {
    for (const event of plot.events) {
      const dependencies = (event.dependencies || [])
        .map((dependency) => ({
          eventId: eventIds[`${dependency.plotKey}::${dependency.eventKey}`],
          plotLineId: plotIds[dependency.plotKey],
          relationshipType: dependency.relationshipType,
          description: dependency.description || '',
        }))
        .filter((dependency) => dependency.eventId && dependency.plotLineId)
      if (dependencies.length === 0) continue

      const eventId = eventIds[`${plot.key}::${event.key}`]
      const live = (await call('GET', `/v1/stories/${storyId}/plots`))
        .find((line) => line.id === plotIds[plot.key])
        .events.find((entry) => entry.id === eventId)
      await call('PATCH', `/v1/stories/${storyId}/plots/${plotIds[plot.key]}/events/${eventId}`, {
        name: event.name,
        content: event.content,
        characterIds: (event.characterKeys || []).map((key) => characterIds[key]).filter(Boolean),
        locationId: event.locationKey ? placeIds[event.locationKey] || null : null,
        dependencies,
        tensionLevel: event.tensionLevel,
        pacing: event.pacing,
        storyBeat: event.storyBeat,
        emotionalTone: event.emotionalTone || '',
        chapterNumber: event.chapterNumber ?? null,
        notes: event.notes || '',
      }, live.revision)
    }
  }

  return { storyId, title: story.title, chapterCount: payload.chapters.length, replay: false }
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
      throw new Error('Run `npm run build` first — --dry-run validates against lib/domain/adminStorySchemas.js')
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
  admin.initializeApp({
    projectId: options.projectId,
    // Lets a gcloud user login sign custom tokens via the IAM signBlob API instead
    // of looking for a local private key (or the GCE metadata server, which is
    // absent off-GCP). Ignored when the credential already carries a private key.
    ...(options.serviceAccount ? { serviceAccountId: options.serviceAccount } : {}),
  })

  const ownerUid = options.ownerUid || (await ensureOwner({ email: options.ownerEmail, prod: options.prod }))
  // The token is minted for the owner, not an admin: story-data creates
  // entities for whoever is calling, so there is nothing to impersonate.
  const idToken = await mintIdToken({ uid: ownerUid, prod: options.prod, projectId: options.projectId })
  const baseUrl = resolveUrl(options)
  const ctx = { idToken, ownerUid }
  console.log(`  owner ${ownerUid}`)
  console.log(`  into  ${baseUrl}\n`)

  let failed = 0
  for (const file of files) {
    const label = path.relative(process.cwd(), file)
    const payload = loadPayload(file, { ...options, ownerUid })
    try {
      const result = await importPayload({ baseUrl, ctx, payload })
      const suffix = result.replay ? ' (already imported)' : ` ${result.chapterCount}ch`
      console.log(`  ok  ${label} -> ${result.storyId} "${result.title}"${suffix}`)
    } catch (error) {
      failed += 1
      console.log(`  fail ${label} -> ${error.message}`)
    }
  }

  console.log(`\nDone. ${files.length - failed} succeeded, ${failed} failed.`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
