# Repository Guidelines — taleTribe-frontend

This repository contains the React/Vite client, Firebase configuration, and
Cloud Functions that remain during the PostgreSQL migration.

## Commands

- `yarn dev`: run Vite.
- `yarn build`: type-check and build the client.
- `yarn lint` and `yarn test`: lint and run unit tests.
- `npm run emulator --prefix functions`: build Functions and start Firebase
  emulators. Prefer `../story/dev-new.sh` when testing the integrated stack.

## Architecture rules

- Use the frontend story-data client and Vite `/story-data` proxy for migrated
  stories, chapters, worldbuilding, public reads, social interactions, reading
  history, guestbooks, book clubs, and competitions.
- Do not add new Firestore access for domains owned by story-data. Firebase
  remains appropriate for Auth, legacy jobs, encrypted BYOK settings, and
  features not yet migrated.
- Never place PostgreSQL or Neon credentials in browser code. Authenticate to
  story-data with the current Firebase ID token.
- Keep request DTOs, revision/`If-Match` handling, loading states, and error
  handling aligned with story-data’s HTTP API.
- Functions target Node 22. Use the project-supported Node version when
  changing or deploying Functions.

## Verification

Run `yarn build` for client changes. For integrated behavior, run
`../story/dev-new.sh`, sign in as `dev@novelsync.local` / `dev123456`, and
exercise the relevant UI flow.
