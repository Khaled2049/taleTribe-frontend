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
const { getAuth } = require('firebase-admin/auth')

const DEFAULT_PROJECT = 'story-6f89f'
const DEFAULT_OWNER_EMAIL = 'seed-owner@taletribe.local'
const AUTH_EMULATOR_HOST = '127.0.0.1:9099'

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

/** Resolve (and in the emulator create) the account stories will be attributed to. */
async function ensureOwner({ email, prod }) {
  try {
    return (await getAuth().getUserByEmail(email)).uid
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    if (prod) {
      throw new Error(`Owner ${email} does not exist — pass --owner-uid for production`)
    }
    const user = await getAuth().createUser({ email, emailVerified: true, displayName: 'seed-owner' })
    console.log(`  created owner user ${email} (${user.uid})`)
    return user.uid
  }
}

/**
 * story-data writes only for an owner with a profile and an accepted writer
 * agreement. Locally both are created for the seed account; in production the
 * owner must have done both themselves, since accepting terms is theirs to do.
 */
async function ensureOwnerCanWrite({ baseUrl, ctx, prod }) {
  let hasProfile = true
  try {
    await storyData(baseUrl, ctx, 'GET', '/v1/profiles/me')
  } catch (error) {
    if (error.status !== 404) throw error
    hasProfile = false
  }
  if (!hasProfile) {
    if (prod) {
      throw new Error(`Owner ${ctx.ownerUid} has no story-data profile — sign in once to create it`)
    }
    // story-data usernames are 3-20 letters, digits or underscores.
    const username = `seed_${ctx.ownerUid.slice(0, 8).toLowerCase().replace(/[^a-z0-9_]/g, '_')}`
    await storyData(baseUrl, ctx, 'PUT', '/v1/profiles/me', { username, guestbookPolicy: 'everyone' })
    console.log(`  created owner profile ${username}`)
  }

  const agreement = await storyData(baseUrl, ctx, 'GET', '/v1/me/writer-agreement')
  if (agreement.accepted) return
  if (prod) {
    throw new Error(`Owner ${ctx.ownerUid} has not accepted the writer agreement — they must, in the editor`)
  }
  await storyData(baseUrl, ctx, 'POST', '/v1/me/writer-agreement', {
    termsVersion: agreement.termsVersion,
    privacyVersion: agreement.privacyVersion,
    attestationVersion: agreement.attestationVersion,
    agreeTerms: true,
    acknowledgePrivacy: true,
    attestRights: true,
    adult: true,
  })
  console.log('  accepted the writer agreement for the local seed owner')
}

/** Exchange a custom token for an ID token so the function sees a real bearer token. */
async function mintIdToken({ uid, prod, projectId }) {
  let customToken
  try {
    customToken = await getAuth().createCustomToken(uid)
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
 * The payload addresses everything by key (`characterKeys`, `locationKey`)
 * because it was written for a Firestore aggregate that could allocate every
 * id up front. story-data assigns ids on insert instead, so entities are
 * created first and later references use the ids they were given.
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
  const chapterIds = {}
  for (const [index, chapter] of payload.chapters.entries()) {
    if (index === 0 && opening) {
      await call('PATCH', `/v1/stories/${storyId}/chapters/${opening.id}`, {
        title: chapter.title,
        content: chapter.content,
        position: opening.position,
      }, opening.revision)
      chapterIds[chapter.key] = opening.id
    } else {
      const created = await call('POST', `/v1/stories/${storyId}/chapters`, {
        title: chapter.title,
        content: chapter.content,
        position: index,
      })
      chapterIds[chapter.key] = created.id
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

  for (const plot of payload.plots) {
    const created = await call('POST', `/v1/stories/${storyId}/plots`, {
      name: plot.name,
      description: plot.description,
    })

    for (const event of plot.events) {
      await call('POST', `/v1/stories/${storyId}/plots/${created.id}/events`, {
        name: event.name,
        content: event.content,
        characterIds: (event.characterKeys || []).map((key) => characterIds[key]).filter(Boolean),
        locationId: event.locationKey ? placeIds[event.locationKey] || null : null,
        pacing: event.pacing,
        storyBeat: event.storyBeat,
        emotionalTone: event.emotionalTone || '',
        chapterId: event.chapterKey ? chapterIds[event.chapterKey] || null : null,
        status: event.status,
        notes: event.notes || '',
      })
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
  await ensureOwnerCanWrite({ baseUrl, ctx, prod: options.prod })
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
