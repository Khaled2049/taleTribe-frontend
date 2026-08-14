#!/usr/bin/env node

/**
 * Seed competitions in every lifecycle phase, plus the test users to drive them.
 *
 * Usage:
 *   npm run seed-competitions                      # everything, 5 writers
 *   npm run seed-competitions -- --users=8
 *   npm run seed-competitions -- --only=voting,settled
 *   npm run seed-competitions -- --reset           # remove previously seeded data first
 *   npm run seed-competitions -- --list            # print the roster and exit
 *
 * Emulator only. It creates sign-in-able accounts with a shared known password
 * and mints TALE from the admin grant endpoint, so pointing it at production
 * would be handing out real admin identities and real supply. There is
 * deliberately no --prod flag, and it refuses to run against a non-local
 * Firestore host.
 *
 * Requires (in another terminal):
 *   yarn start:emulator          # auth + firestore + functions, with triggers
 *   npm run build                # inside functions/, for lib/userProfileDefaults
 *
 * HOW THE PHASES ARE REACHED
 *
 * Everything that CAN be produced through the real HTTP endpoints IS — create,
 * join, submit, vote, cancel and settle all run through the deployed functions,
 * so the seeded documents are shaped exactly like production ones and the
 * double-entry ledger really moves. Reaching a past-deadline phase is done by
 * creating with live dates, entering, then editing the dates into the past
 * while the competition is still editable (draft/open are the only editable
 * phases) and letting `ensurePhase` advance it on the next call. That is the
 * same path a real competition takes, just without the waiting.
 *
 * Three scenarios cannot come from the API and are written with the Admin SDK.
 * Each is a state the system is designed to *recover from*, so none of them has
 * a legitimate way in:
 *
 *   settling      a settlement run that crashed after claiming the phase.
 *                 advanceCompetitionPhase refuses to write `settling` on
 *                 purpose — only settleCompetition may claim it. Call
 *                 settleCompetition on the seeded id to test the retry.
 *   funding-stuck a create that died between the document write and escrow
 *                 confirming. This is what a reconciliation sweep looks for.
 *   legacy        a pre-TALE competition: legacyPrizeLabel, no prizePool,
 *                 escrowState "unfunded". The only place the dual-read in
 *                 CompetitionService.toCompetition still gets exercised.
 *
 * PAID ENTRY
 *
 * `open-paid`, `settled-paid` and `cancelled-paid` charge an entry fee, so the
 * seed exercises the multi-funder escrow paths a free competition never touches:
 * fees held alongside the pool, the platform/host split at settlement, and a
 * cancellation that refunds every entrant rather than sweeping to the host.
 *
 * ONE EMULATOR QUIRK WORTH KNOWING
 *
 * The emulator's task queue fires `scheduleDelaySeconds` immediately, so a
 * competition that enters `voting` is auto-settled seconds later regardless of
 * its voting deadline — which otherwise makes the voting UI impossible to look
 * at locally. The competitions that must stay in `voting` therefore sit past
 * the 25-day scheduling horizon (see BEYOND_TASK_HORIZON), where no task is
 * enqueued at all. The two settled scenarios keep realistic past deadlines and
 * simply let that race happen: settleCompetition is idempotent by design, so
 * whichever of the task and this script gets there first, the result is the
 * same.
 *
 * Options:
 *   --users=<n>            Test writers to create (default 5, min 3)
 *   --only=<keys>          Comma-separated scenario keys (see --list)
 *   --password=<pw>        Shared password for seeded accounts (default test1234)
 *   --admin-email=<email>  Admin identity (default admin@taletribe.local)
 *   --prize=<n>            Whole TALE escrowed per competition (default 250)
 *   --reset                Delete previously seeded competitions first
 *   --list                 Print the scenario roster and exit
 *   --project=<id>         Firebase project id (default story-6f89f)
 *   --help                 Show this message
 */

const admin = require('firebase-admin')

const DEFAULT_PROJECT = 'story-6f89f'
const DEFAULT_ADMIN_EMAIL = 'admin@taletribe.local'
const DEFAULT_PASSWORD = 'test1234'
const DEFAULT_PRIZE_TALE = 250
const AUTH_EMULATOR_HOST = '127.0.0.1:9099'
const FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
const FUNCTIONS_EMULATOR_ORIGIN = 'http://127.0.0.1:5001'
const REGION = 'us-central1'

/** Marks a document as ours so --reset can find it without guessing by title. */
const SEED_TAG = 'seed-competitions'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/**
 * Voting deadline offset for the phases that must STAY in `voting`.
 *
 * The Firebase emulator's task queue ignores `scheduleDelaySeconds` and
 * dispatches immediately, and competitionAdvanceTask only verifies that the
 * stored date still matches what the task was scheduled against — never that
 * the time has actually arrived. So in the emulator, a competition that reaches
 * `voting` with any reachable voting deadline is settled within seconds,
 * whatever that deadline says.
 *
 * `enqueueAdvance` declines to schedule anything more than 25 days out (Cloud
 * Tasks' own limit), leaving lazy advance to cover correctness. Sitting past
 * that horizon is therefore an ordinary in-system state, not a trick: no task
 * is ever enqueued, and the competition stays in `voting` until something
 * touches it. That is what makes the voting UI observable locally at all.
 *
 * In production Cloud Tasks honours the schedule, so this only shapes seeding.
 */
const BEYOND_TASK_HORIZON = 30 * DAY

// ---------------------------------------------------------------------------
// Scenario roster
// ---------------------------------------------------------------------------

/**
 * `dates` are offsets in ms from now, applied at creation time.
 * `retime` (optional) is the second set of offsets applied while the
 * competition is still editable, to push it past a deadline.
 */
const SCENARIOS = [
  {
    key: 'scheduled',
    title: 'The Lantern Keeper — Opening Soon',
    summary: 'Published and funded, not yet open. Start date in the future.',
    expectPhase: 'scheduled',
    dates: { start: 2 * DAY, deadline: 9 * DAY, voting: 12 * DAY },
    entrants: 0,
  },
  {
    key: 'draft',
    title: 'Untitled Competition (Work in Progress)',
    summary: 'Unpublished draft. No escrow, invisible to everyone but its host.',
    expectPhase: 'draft',
    dates: { start: 3 * DAY, deadline: 10 * DAY, voting: 13 * DAY },
    draft: true,
  },
  {
    key: 'open',
    title: 'Salt and Static',
    summary: 'Accepting entries. Participants and submissions present.',
    expectPhase: 'open',
    dates: { start: -1 * DAY, deadline: 6 * DAY, voting: 9 * DAY },
    entrants: 3,
  },
  {
    key: 'open-full',
    title: 'Two Seats Only',
    summary: 'Open but at maxParticipants — joining should be rejected.',
    expectPhase: 'open',
    dates: { start: -1 * DAY, deadline: 5 * DAY, voting: 8 * DAY },
    maxParticipants: 2,
    entrants: 2,
  },
  {
    key: 'open-paid',
    title: 'The Vellum Prize',
    summary:
      'Paid entry. 25 TALE per entrant, held in escrow beside the pool and refunded on withdrawal.',
    expectPhase: 'open',
    dates: { start: -1 * DAY, deadline: 6 * DAY, voting: 9 * DAY },
    entryFeeTale: 25,
    entrants: 3,
  },
  {
    key: 'settled-paid',
    title: 'The Ninth Letter',
    summary:
      'Paid entry, settled with a winner — pool to first place, fees split platform/host.',
    expectPhase: 'settled',
    dates: { start: -12 * DAY, deadline: 1 * DAY, voting: 8 * DAY },
    retime: { deadline: -3 * HOUR, voting: -1 * HOUR },
    entryFeeTale: 25,
    entrants: 3,
    voters: 'all',
    settle: true,
  },
  {
    key: 'cancelled-paid',
    title: 'Called Off: The Tin Bell',
    summary:
      'Paid entry, then cancelled — every entrant refunded, not just the host.',
    expectPhase: 'cancelled',
    dates: { start: -1 * DAY, deadline: 6 * DAY, voting: 9 * DAY },
    entryFeeTale: 25,
    entrants: 2,
    cancel: true,
  },
  {
    key: 'voting',
    title: 'The Weight of Small Hours',
    summary: 'Submissions closed, ballots open. Live standings stay hidden.',
    expectPhase: 'voting',
    dates: { start: -2 * DAY, deadline: 1 * DAY, voting: 8 * DAY },
    // See BEYOND_TASK_HORIZON. A nearer voting deadline gets settled within
    // seconds by the emulator's task queue.
    retime: { deadline: -1 * HOUR, voting: BEYOND_TASK_HORIZON },
    entrants: 3,
    voters: 'all',
  },
  {
    key: 'settling',
    title: 'Ashfall (Payout Interrupted)',
    summary: 'Stuck mid-settlement. Retry with settleCompetition.',
    expectPhase: 'settling',
    dates: { start: -10 * DAY, deadline: 1 * DAY, voting: 8 * DAY },
    retime: { deadline: -1 * HOUR, voting: BEYOND_TASK_HORIZON },
    entrants: 3,
    voters: 'all',
    forcePhase: 'settling',
  },
  {
    key: 'settled',
    title: 'The Cartographer’s Apprentice',
    summary: 'Settled with a real winner — escrow released, digest written.',
    expectPhase: 'settled',
    dates: { start: -12 * DAY, deadline: 1 * DAY, voting: 8 * DAY },
    retime: { deadline: -3 * HOUR, voting: -1 * HOUR },
    entrants: 3,
    voters: 'all',
    settle: true,
  },
  {
    key: 'settled-refunded',
    title: 'Nobody Came to Vote',
    summary: 'Entries but zero ballots — pool refunded to the creator.',
    expectPhase: 'settled',
    dates: { start: -12 * DAY, deadline: 1 * DAY, voting: 8 * DAY },
    retime: { deadline: -3 * HOUR, voting: -1 * HOUR },
    entrants: 2,
    voters: 'none',
    settle: true,
  },
  {
    key: 'cancelled',
    title: 'Withdrawn: The Glass Orchard',
    summary: 'Cancelled before voting — escrow refunded to the creator.',
    expectPhase: 'cancelled',
    dates: { start: -1 * DAY, deadline: 6 * DAY, voting: 9 * DAY },
    entrants: 1,
    cancel: true,
  },
  {
    key: 'funding-stuck',
    title: 'Hollow Pledge (Escrow Never Confirmed)',
    summary: 'Direct write. escrowState "funding" — reconciliation target.',
    expectPhase: 'scheduled',
    direct: 'funding-stuck',
  },
  {
    key: 'legacy',
    title: 'The Old Prize (Pre-TALE)',
    summary: 'Direct write. legacyPrizeLabel, no prizePool, unfunded escrow.',
    expectPhase: 'open',
    direct: 'legacy',
  },
]

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = new Map()
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith('--')) continue
    const [name, ...rest] = arg.slice(2).split('=')
    flags.set(name, rest.length ? rest.join('=') : true)
  }

  const only = flags.get('only')
  const users = Number.parseInt(flags.get('users') || '5', 10)
  const prize = Number.parseInt(flags.get('prize') || String(DEFAULT_PRIZE_TALE), 10)

  return {
    users: Number.isNaN(users) ? 5 : Math.max(3, users),
    prizeTale: Number.isNaN(prize) || prize <= 0 ? DEFAULT_PRIZE_TALE : prize,
    only: typeof only === 'string' ? only.split(',').map((k) => k.trim()).filter(Boolean) : null,
    password: flags.get('password') || DEFAULT_PASSWORD,
    adminEmail: flags.get('admin-email') || DEFAULT_ADMIN_EMAIL,
    projectId: flags.get('project') || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT,
    reset: flags.has('reset'),
    list: flags.has('list'),
    help: flags.has('help') || flags.has('h'),
    prod: flags.has('prod'),
  }
}

function printHelp() {
  const source = require('fs').readFileSync(__filename, 'utf8')
  console.log(source.split('*/')[0].split('/**')[1].replace(/^ \* ?/gm, ''))
}

// ---------------------------------------------------------------------------
// Money helpers (mirrors functions/src/money.ts)
// ---------------------------------------------------------------------------

const TALE_DECIMALS = 18
const tale = (whole) => (BigInt(whole) * 10n ** BigInt(TALE_DECIMALS)).toString()

const formatTale = (minor) => {
  const raw = BigInt(minor).toString().padStart(TALE_DECIMALS + 1, '0')
  const whole = raw.slice(0, raw.length - TALE_DECIMALS)
  const fraction = raw.slice(raw.length - TALE_DECIMALS).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

function loadUserProfileDefaults() {
  try {
    return require('../lib/userProfileDefaults').buildUserProfileDefaults
  } catch {
    throw new Error(
      'Run `npm run build` in functions/ first — seeded profiles reuse lib/userProfileDefaults.js',
    )
  }
}

async function ensureAuthUser({ email, displayName, password }) {
  try {
    return await admin.auth().getUserByEmail(email)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    return admin.auth().createUser({
      email,
      password,
      emailVerified: true,
      displayName,
    })
  }
}

/** Auth user + the three Firestore writes createUserByAdmin makes. */
async function ensureProfile({ uid, email, username }) {
  const db = admin.firestore()
  const userRef = db.collection('users').doc(uid)
  const snapshot = await userRef.get()

  if (typeof snapshot.data()?.username === 'string' && snapshot.data().username.trim()) {
    return snapshot.data().username
  }

  const profile = loadUserProfileDefaults()({ username, email })
  await db.collection('usernames').doc(username.toLowerCase()).set({ uid })
  await userRef.set(profile, { merge: true })
  await db.collection('publicProfiles').doc(uid).set(
    {
      username,
      bio: profile.bio,
      occupation: profile.occupation,
      location: profile.location,
      createdAt: profile.createdAt,
      updatedAt: profile.createdAt,
    },
    { merge: true },
  )
  return username
}

async function ensureAdmin({ email, password }) {
  const user = await ensureAuthUser({ email, displayName: 'seed-admin', password })
  if (!user.customClaims?.admin) {
    await admin.auth().setCustomUserClaims(user.uid, {
      ...(user.customClaims || {}),
      admin: true,
    })
  }
  await ensureProfile({
    uid: user.uid,
    email,
    username: `admin_${user.uid.slice(0, 6).toLowerCase()}`,
  })
  return user
}

/** Custom token -> ID token, so functions see a real verifiable bearer token. */
async function mintIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid)
  const response = await fetch(
    `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  const body = await response.json()
  if (!response.ok || !body.idToken) {
    throw new Error(`Failed to mint ID token: ${JSON.stringify(body)}`)
  }
  return body.idToken
}

// ---------------------------------------------------------------------------
// Function calls
// ---------------------------------------------------------------------------

function makeCaller(projectId) {
  return async function call(name, idToken, payload) {
    const response = await fetch(
      `${FUNCTIONS_EMULATOR_ORIGIN}/${projectId}/${REGION}/${name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload ?? {}),
      },
    )

    const text = await response.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text.slice(0, 300) }
    }

    if (!response.ok) {
      const error = new Error(`${name} -> ${response.status}: ${body.error || text.slice(0, 200)}`)
      error.status = response.status
      error.body = body
      throw error
    }
    return body
  }
}

// ---------------------------------------------------------------------------
// Test users
// ---------------------------------------------------------------------------

const STORY_BLURBS = [
  ['Tidewrack', 'A lighthouse keeper starts receiving letters from the sea.'],
  ['The Paper Cartographer', 'Maps that redraw themselves overnight.'],
  ['Nine Kinds of Quiet', 'A town where sound has been rationed for a century.'],
  ['Ironwood Season', 'The last apprentice of a dying craft.'],
  ['Where the Signal Ends', 'A radio operator hears her own voice replying.'],
  ['The Salt Archive', 'Every memory in the city is stored in brine.'],
  ['Understudy', 'The role was written for someone who never existed.'],
  ['Long Division', 'Two siblings split an inheritance that keeps growing.'],
]

function storyPayload(uid, index) {
  const [title, description] = STORY_BLURBS[index % STORY_BLURBS.length]
  return {
    idempotencyKey: `seed-comp-story-${uid}`,
    ownerUid: uid,
    story: {
      title,
      description,
      isPublished: true,
      category: 'Fiction',
      tags: ['seed', 'competition'],
    },
    chapters: [
      {
        key: 'chapter-one',
        title: 'Chapter One',
        content:
          `${description} It began, as these things do, on an ordinary morning ` +
          'that gave no warning at all. The kettle boiled. The post arrived. ' +
          'And somewhere between the two, the shape of the year changed.',
      },
    ],
  }
}

/**
 * Create the writers.
 *
 * Each needs a published story for two separate reasons: submitToCompetition
 * refuses unpublished stories, and castCompetitionVote gates on
 * `users/{uid}.storyCount >= 1`. That counter is maintained by the onStoryWrite
 * trigger, so it lands asynchronously — hence the poll below.
 */
async function seedWriters({ count, password, call }) {
  const writers = []

  for (let index = 0; index < count; index++) {
    const number = index + 1
    const email = `writer${number}@taletribe.local`
    const user = await ensureAuthUser({
      email,
      displayName: `Writer ${number}`,
      password,
    })
    const username = await ensureProfile({
      uid: user.uid,
      email,
      username: `writer${number}`,
    })
    const idToken = await mintIdToken(user.uid)
    writers.push({ uid: user.uid, email, username, idToken, index })
    console.log(`  writer${number}  ${email}  ${user.uid}`)
  }

  return writers
}

async function seedStories({ writers, adminToken, call }) {
  for (const writer of writers) {
    const result = await call('createStoryByAdmin', adminToken, storyPayload(writer.uid, writer.index))
    writer.storyId = result.storyId
  }
}

/** Wait for onStoryWrite to land storyCount, which voting eligibility reads. */
async function waitForStoryCounts(writers, timeoutMs = 20000) {
  const db = admin.firestore()
  const deadline = Date.now() + timeoutMs
  const pending = new Set(writers.map((writer) => writer.uid))

  while (pending.size > 0 && Date.now() < deadline) {
    for (const uid of [...pending]) {
      const snapshot = await db.collection('users').doc(uid).get()
      if ((snapshot.data()?.storyCount ?? 0) >= 1) pending.delete(uid)
    }
    if (pending.size === 0) break
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  if (pending.size > 0) {
    // Don't fail the run — the counter is a soft gate and only voting needs it.
    console.warn(
      `  ! storyCount never arrived for ${pending.size} writer(s). Is the functions ` +
        'emulator running with triggers? Voting will be rejected for them.',
    )
  }
}

// ---------------------------------------------------------------------------
// Scenario execution
// ---------------------------------------------------------------------------

const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString()

async function stampSeedTag(competitionId, key) {
  await admin.firestore().collection('competitions').doc(competitionId).update({
    seedTag: SEED_TAG,
    seedScenario: key,
  })
}

/**
 * Build a competition through the real endpoints and walk it to its phase.
 */
async function runApiScenario({ scenario, adminUser, adminToken, writers, prizeTale, call }) {
  // Everything starts as a draft now; publishing is the separate step that
  // funds escrow. A `draft: true` scenario simply stops here.
  const created = await call('saveCompetitionDraft', adminToken, {
    title: scenario.title,
    description:
      `${scenario.summary} Seeded by scripts/seed-competitions.js for local testing.`,
    category: 'Short Fiction',
    tags: ['seed', scenario.key],
    maxParticipants: scenario.maxParticipants ?? null,
    startDate: iso(scenario.dates.start),
    deadline: iso(scenario.dates.deadline),
    votingDeadline: iso(scenario.dates.voting),
    prizeAmount: tale(prizeTale),
    ...(scenario.entryFeeTale ? { entryFee: tale(scenario.entryFeeTale) } : {}),
    creatorName: 'TaleTribe',
  })

  const competitionId = created.competitionId

  if (scenario.draft) {
    await stampSeedTag(competitionId, scenario.key)
    return competitionId
  }

  await call('publishCompetition', adminToken, { competitionId })
  await stampSeedTag(competitionId, scenario.key)

  // Entrants: join, then submit. The creator is barred from entering their own
  // competition, which is why the admin is never in this list.
  const entrants = writers.slice(0, scenario.entrants ?? 0)
  for (const writer of entrants) {
    await call('joinCompetition', writer.idToken, { competitionId })
    await call('submitToCompetition', writer.idToken, {
      competitionId,
      storyId: writer.storyId,
    })
  }

  // Push the dates into the past while the competition is still editable, then
  // let ensurePhase do the advancing.
  if (scenario.retime) {
    const body = { competitionId }
    if (scenario.retime.deadline !== undefined) body.deadline = iso(scenario.retime.deadline)
    if (scenario.retime.voting !== undefined) body.votingDeadline = iso(scenario.retime.voting)
    await call('updateCompetition', adminToken, body)
    await call('advanceCompetitionPhase', adminToken, { competitionId })
  }

  if (scenario.voters === 'all') {
    const submissionIds = entrants.map((writer) => writer.uid)
    for (const writer of writers) {
      const choices = submissionIds.filter((id) => id !== writer.uid).slice(0, 2)
      if (choices.length === 0) continue
      try {
        await call('castCompetitionVote', writer.idToken, {
          competitionId,
          submissionIds: choices,
        })
      } catch (error) {
        console.warn(`    ! vote by ${writer.username} rejected: ${error.message}`)
      }
    }
  }

  if (scenario.cancel) {
    await call('cancelCompetition', adminToken, { competitionId })
  }

  if (scenario.settle) {
    const outcome = await call('settleCompetition', adminToken, { competitionId })
    const winner = (outcome.results || []).find((result) => BigInt(result.amount) > 0n)
    const detail = outcome.refunded
      ? 'refunded to creator'
      : `winner ${winner ? winner.userId : '?'} took ${formatTale(winner ? winner.amount : '0')} TALE`
    console.log(`    settled: ${detail}`)
  }

  // `settling` has no legitimate entry point — see the header. Written directly
  // so the stuck-payout UI and the settleCompetition retry can be exercised.
  if (scenario.forcePhase) {
    await admin.firestore().collection('competitions').doc(competitionId).update({
      phase: scenario.forcePhase,
      phaseUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }

  return competitionId
}

/** Competitions that cannot exist via the API. Admin SDK writes, by necessity. */
async function runDirectScenario({ scenario, adminUser, prizeTale }) {
  const db = admin.firestore()
  const ref = db.collection('competitions').doc()
  const now = Date.now()
  const timestamp = admin.firestore.FieldValue.serverTimestamp()
  const ts = (offset) => admin.firestore.Timestamp.fromDate(new Date(now + offset))

  const shared = {
    title: scenario.title,
    description: `${scenario.summary} Seeded by scripts/seed-competitions.js for local testing.`,
    category: 'Short Fiction',
    tags: ['seed', scenario.key],
    maxParticipants: null,
    participantsCount: 0,
    submissionCount: 0,
    ballotCount: 0,
    creatorId: adminUser.uid,
    creatorName: 'TaleTribe',
    organizer: 'TaleTribe',
    seedTag: SEED_TAG,
    seedScenario: scenario.key,
    phaseUpdatedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  if (scenario.direct === 'funding-stuck') {
    await ref.set({
      ...shared,
      startDate: ts(1 * DAY),
      deadline: ts(8 * DAY),
      votingDeadline: ts(11 * DAY),
      phase: 'scheduled',
      published: true,
      // No ledger movement: this is precisely a publish that died before escrow
      // confirmed, so there is nothing held for it.
      escrowState: 'funding',
      prizePool: {
        assetId: 'TALE',
        symbol: 'TALE',
        decimals: TALE_DECIMALS,
        amount: tale(prizeTale),
      },
      escrowAccountId: `escrow:competition:${ref.id}`,
      nextTransitionAt: ts(1 * DAY),
    })
    return ref.id
  }

  // legacy: a pre-TALE document — a decorative prize label, no funded pool.
  await ref.set({
    ...shared,
    startDate: ts(-3 * DAY),
    deadline: ts(10 * DAY),
    votingDeadline: ts(13 * DAY),
    phase: 'open',
    published: true,
    escrowState: 'unfunded',
    legacyPrizeLabel: '1,000 USDC',
    prizeAmount: 1000,
    prizeCurrency: 'USDC',
    nextTransitionAt: ts(10 * DAY),
  })
  return ref.id
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function deleteSubcollections(ref) {
  for (const collection of await ref.listCollections()) {
    const documents = await collection.listDocuments()
    for (const document of documents) {
      await deleteSubcollections(document)
      await document.delete()
    }
  }
}

/**
 * Remove previously seeded competitions.
 *
 * Ledger transfers are deliberately left alone. They are double-entry records:
 * deleting one side of a movement would leave balances that no longer reconcile
 * with their history, which is a worse state than a few orphaned escrow
 * accounts holding tokens nothing references. Wipe .emulator-data if you want a
 * genuinely clean ledger.
 */
async function reset({ writers }) {
  const db = admin.firestore()
  const snapshot = await db.collection('competitions').where('seedTag', '==', SEED_TAG).get()

  console.log(`\nResetting ${snapshot.size} previously seeded competition(s)`)
  for (const doc of snapshot.docs) {
    await deleteSubcollections(doc.ref)
    await doc.ref.delete()
  }

  for (const writer of writers) {
    const joins = await db.collection('users').doc(writer.uid).collection('competitionJoins').get()
    for (const join of joins.docs) await join.ref.delete()
  }

  console.log('  ledgerTransfers and tokenAccounts left intact (see the note in reset()).')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv)

  if (options.help) {
    printHelp()
    return
  }

  if (options.list) {
    console.log('\nScenarios:\n')
    for (const scenario of SCENARIOS) {
      const via = scenario.direct ? 'admin sdk' : 'endpoints'
      console.log(`  ${scenario.key.padEnd(18)} ${scenario.expectPhase.padEnd(10)} [${via}]  ${scenario.summary}`)
    }
    console.log()
    return
  }

  if (options.prod) {
    throw new Error(
      'This script is emulator-only. It creates sign-in-able accounts with a shared ' +
        'known password and mints TALE — never run it against production.',
    )
  }

  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= AUTH_EMULATOR_HOST
  process.env.FIRESTORE_EMULATOR_HOST ||= FIRESTORE_EMULATOR_HOST

  if (!/^(127\.0\.0\.1|localhost|0\.0\.0\.0):/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
    throw new Error(
      `FIRESTORE_EMULATOR_HOST points at ${process.env.FIRESTORE_EMULATOR_HOST}, which is not local. Refusing to run.`,
    )
  }

  const selected = options.only
    ? SCENARIOS.filter((scenario) => options.only.includes(scenario.key))
    : SCENARIOS

  if (selected.length === 0) {
    throw new Error(`No scenarios matched --only. Run with --list to see the keys.`)
  }

  admin.initializeApp({ projectId: options.projectId })
  const call = makeCaller(options.projectId)

  console.log(`\nSeeding ${selected.length} competition(s) into the emulator (project ${options.projectId})\n`)

  console.log('Users')
  const adminUser = await ensureAdmin({ email: options.adminEmail, password: options.password })
  console.log(`  admin     ${options.adminEmail}  ${adminUser.uid}`)
  const adminToken = await mintIdToken(adminUser.uid)
  const writers = await seedWriters({ count: options.users, password: options.password, call })

  console.log('\nStories')
  await seedStories({ writers, adminToken, call })
  await waitForStoryCounts(writers)
  console.log(`  ${writers.length} published story/stories created`)

  // Fund the admin well past what the run needs. The 1000 TALE initial grant
  // covers only a few pools, and createCompetition fails closed on an
  // insufficient balance.
  const needed = selected.filter((scenario) => !scenario.direct).length * options.prizeTale
  console.log('\nFunding')
  const grant = await call('adminGrantTokens', adminToken, {
    userId: adminUser.uid,
    amount: tale(Math.max(needed * 2, 10000)),
    nonce: `seed-${Date.now()}`,
  })
  console.log(`  admin balance ${formatTale(grant.balance)} TALE (needs ${needed})`)

  // Reset LAST, once the HTTP path has demonstrably worked.
  //
  // It used to run before any of the above, which made it destructive on
  // failure: deleting competitions only needs Firestore, which answers
  // immediately, while everything that recreates them needs Cloud Functions.
  // Seeding before the functions emulator had finished registering therefore
  // wiped the previous run's competitions and created nothing — leaving zero,
  // with only a warning to show for it. Both calls above are already through,
  // so by here the API is known good.
  if (options.reset) {
    await reset({ writers })
  }

  console.log('\nCompetitions')
  const results = []
  for (const scenario of selected) {
    try {
      const competitionId = scenario.direct
        ? await runDirectScenario({ scenario, adminUser, prizeTale: options.prizeTale })
        : await runApiScenario({
            scenario,
            adminUser,
            adminToken,
            writers,
            prizeTale: options.prizeTale,
            call,
          })

      const snapshot = await admin.firestore().collection('competitions').doc(competitionId).get()
      const phase = snapshot.data()?.phase
      const ok = phase === scenario.expectPhase
      results.push({ scenario, competitionId, phase, ok })

      console.log(
        `  ${ok ? '✓' : '✗'} ${scenario.key.padEnd(18)} ${String(phase).padEnd(10)} ${competitionId}` +
          (ok ? '' : `  (expected ${scenario.expectPhase})`),
      )
    } catch (error) {
      results.push({ scenario, error })
      console.log(`  ✗ ${scenario.key.padEnd(18)} FAILED  ${error.message}`)
    }
  }

  const failed = results.filter((result) => result.error || !result.ok)

  console.log('\nSign in at http://localhost:5173 with any of:')
  console.log(`  ${options.adminEmail} / ${options.password}   (admin)`)
  for (const writer of writers.slice(0, 3)) {
    console.log(`  ${writer.email} / ${options.password}`)
  }
  if (writers.length > 3) console.log(`  ...through writer${writers.length}@taletribe.local`)

  const settling = results.find((result) => result.scenario.key === 'settling' && !result.error)
  if (settling) {
    console.log(
      `\nStuck settlement: POST settleCompetition {"competitionId":"${settling.competitionId}"} to finish it.`,
    )
  }

  console.log(`\nDone. ${results.length - failed.length}/${results.length} scenarios landed in the expected phase.`)
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
