# TheTaleTribe

**Where stories are written, discovered, and shared.**

[![PR checks](https://github.com/Khaled2049/taleTribe-frontend/actions/workflows/pr-check.yml/badge.svg)](https://github.com/Khaled2049/taleTribe-frontend/actions/workflows/pr-check.yml)

TheTaleTribe is an open-source platform for independent writers and readers. It
brings the entire life of a story into one place: planning and drafting,
publishing and reading, discovering new voices, and building a community around
the work.

[Visit TheTaleTribe](https://thetaletribe.com) ·
[Report an issue](https://github.com/Khaled2049/taleTribe-frontend/issues)

![An open notebook on a writer's desk](public/images/landing/hero-editorial.png)

## What you can do

### Write and build your story world

The writing workspace combines a focused long-form editor with the planning
tools needed to keep a growing story consistent.

- Draft and organize chapters in a rich-text editor with autosave.
- Develop plot points alongside the manuscript.
- Create character profiles and keep important details close at hand.
- Build a catalog of places that make up the story's world.
- Publish when the story is ready to meet its readers.

### Read your way

The reader is designed for both immersion and utility. Readers can customize
the reading experience, keep their place, search within a story, highlight
passages, look up words, and use read-aloud controls. Story pages also give
readers a place to respond to the work and connect with its author.

### Discover your next story

The Discover page supports regular browsing and AI-assisted recommendations.
Readers can search by theme, mood, or the kind of experience they want, explore
personalized shelves, find stories similar to one they already enjoy, and see
why a recommendation may be a good match.

### Join writing competitions

Community competitions give writers a reason to create together. Hosts can
publish a brief and schedule, writers can submit eligible stories, and the
community can take part in blind voting. The competition flow tracks each
stage—from draft and entry through judging and results—in one place.

### Read together in book clubs

Book clubs turn reading into a shared experience. Clubs can choose a book,
create a reading schedule, track member progress, hold chapter-based
discussions with spoiler protection, chat together, and decide what to read
next.

### Leave your mark in the guestbook

Every member can have a guestbook: a personal wall where the community can
leave notes and continue the conversation through replies. A people directory,
following feed, and privacy controls help members find one another while
keeping control of their space.

## AI that works with the writer

TheTaleTribe uses AI as a creative assistant, not as a replacement for the
author. Suggestions remain optional and editable, and writers stay in control
of what becomes part of their work.

AI-powered tools include:

- Context-aware co-writing and next-line suggestions.
- Brainstorming for plots, characters, places, and new story directions.
- Rewriting, expanding, and refining selected prose.
- Story-aware chat that can reason over the writer's existing material.
- Chapter, cover, and in-story image generation.
- Natural-language story discovery and personalized recommendations.
- A connector that allows approved AI clients to work with a writer's stories.

Writers can use TheTaleTribe's shared AI allowance or bring their own Gemini,
Claude, or OpenAI API key. Provider credentials are handled through protected
server-side settings and must never be exposed in browser code.

## Platform at a glance

TheTaleTribe is split into a small collection of services. This repository is
the web client and contains the Firebase configuration and Cloud Functions that
remain in use during the platform's PostgreSQL migration.

| Project | Role |
| --- | --- |
| **`taleTribe-frontend`** | React web app, Firebase integration, and browser-facing platform experience |
| **`story-data`** | PostgreSQL-backed API for stories and community data |
| **`taletribe-recs`** | Story catalog, similarity search, and recommendation service |
| **`taleTribe-agents`** | AI agent and external assistant integrations |
| **`contracts`** | Smart contracts used by supported on-chain features |

The frontend authenticates API requests with the current Firebase ID token.
PostgreSQL credentials and other service secrets belong on the server and must
never be added to Vite environment variables.

## Built with

- React 19, TypeScript, and Vite
- TipTap for the writing experience
- Tailwind CSS for the Inkwell design system
- TanStack Query and Zustand for server and client state
- Firebase Authentication, Cloud Functions, Storage, and realtime features
- PostgreSQL-backed domain services
- Vitest and Cypress for automated testing
- wagmi and viem for supported wallet interactions

For a deeper tour of this repository, see
[the frontend architecture guide](docs/frontend-architecture.md).

## Getting started

### Prerequisites

- Node.js 22 (the version in `.nvmrc`)
- Yarn
- A Firebase project for authenticated and data-backed flows
- The companion services for full-platform development

### Run the frontend

```bash
git clone https://github.com/Khaled2049/taleTribe-frontend.git
cd taleTribe-frontend
nvm use
yarn install
cp .env.example .env.local
yarn dev
```

Open [http://localhost:5173](http://localhost:5173). Features backed by other
services require those services to be running and configured.

Update `.env.local` with your own Firebase public configuration and any local
service URLs you need. Values prefixed with `VITE_` are bundled into the client,
so never put private API keys, database credentials, or server secrets in them.

### Run the integrated platform

When the companion repositories are checked out in the shared workspace, run
`./dev-new.sh` from the workspace root. It starts the local services, Firebase
emulators, and Vite together and seeds the development account documented by
the workspace tooling.

## Useful commands

| Command | Purpose |
| --- | --- |
| `yarn dev` | Start the Vite development server |
| `yarn build` | Type-check and create a production build |
| `yarn lint` | Run ESLint |
| `yarn test` | Run the Vitest unit suite |
| `yarn test:watch` | Run unit tests in watch mode |
| `yarn e2e` | Run the full Cypress end-to-end stack |
| `npm run emulator --prefix functions` | Build Cloud Functions and start Firebase emulators |

## Contributing

Contributions are welcome—whether that is a bug fix, a feature, documentation,
design feedback, or a new idea.

1. Check the [open issues](https://github.com/Khaled2049/taleTribe-frontend/issues)
   or open one to discuss a larger change.
2. Fork the repository and create a focused branch.
3. Make the change and add or update tests where appropriate.
4. Run `yarn lint`, `yarn test`, and `yarn build`.
5. Open a pull request explaining the change and how it was verified.

When contributing data-backed features, use the `story-data` client for domains
that have moved to PostgreSQL. Firebase remains appropriate for authentication,
realtime chat, legacy jobs, encrypted BYOK settings, and features that have not
yet migrated.

## Security

Please do not report vulnerabilities in a public issue. Follow the private
reporting process in [SECURITY.md](SECURITY.md).
