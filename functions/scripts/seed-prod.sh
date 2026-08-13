#!/usr/bin/env bash
#
# One-command production seeding through createStoryByAdmin.
#
#   ./scripts/seed-prod.sh                          # every payload under story-ideas/
#   ./scripts/seed-prod.sh story-ideas/fantasy      # a subset
#   ./scripts/seed-prod.sh story-ideas --dry-run    # validate only, no prod writes
#   ./scripts/seed-prod.sh story-ideas --key-suffix=run2
#   SEED_YES=1 ./scripts/seed-prod.sh               # skip the confirmation prompt
#
# Prerequisites:
#   1. createStoryByAdmin is deployed        (npm run deploy)
#   2. the admin account holds the claim     (npm run set-admin -- <email> --prod)
#   3. credentials that can sign a custom token as SERVICE_ACCOUNT — either
#      roles/iam.serviceAccountTokenCreator on it for your gcloud login, or
#      GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key
#
# Every value below can be overridden with the matching SEED_* env var.

set -euo pipefail

PROJECT="${SEED_PROJECT:-story-6f89f}"
ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-shoibal.not@gmail.com}"
OWNER_UID="${SEED_OWNER_UID:-ae72nmdikNgIyEk87UZLlhAjoKF3}"
SERVICE_ACCOUNT="${SEED_SERVICE_ACCOUNT:-firebase-adminsdk-fbsvc@${PROJECT}.iam.gserviceaccount.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTIONS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$FUNCTIONS_DIR")"

targets=("$@")
if [[ ${#targets[@]} -eq 0 ]]; then
  targets=(story-ideas)
fi

# The seed script reads process.env only — it never loads .env itself.
if [[ -z "${FIREBASE_API_KEY:-}${VITE_FIREBASE_API_KEY:-}" && -f "$ROOT_DIR/.env" ]]; then
  VITE_FIREBASE_API_KEY="$(grep -m1 '^VITE_FIREBASE_API_KEY=' "$ROOT_DIR/.env" | cut -d= -f2- | tr -d "\"'")"
  export VITE_FIREBASE_API_KEY
fi
if [[ -z "${FIREBASE_API_KEY:-}${VITE_FIREBASE_API_KEY:-}" ]]; then
  echo "error: no web API key found — export FIREBASE_API_KEY or add VITE_FIREBASE_API_KEY to $ROOT_DIR/.env" >&2
  exit 1
fi

# --prod does not clear these; a stray emulator host would silently redirect the run.
unset FIREBASE_AUTH_EMULATOR_HOST FIRESTORE_EMULATOR_HOST

# --dry-run validates against the compiled schema in lib/.
if [[ ! -d "$FUNCTIONS_DIR/lib" ]]; then
  (cd "$FUNCTIONS_DIR" && npm run build)
fi

echo "project      $PROJECT"
echo "admin        $ADMIN_EMAIL"
echo "owner uid    $OWNER_UID"
echo "signing as   $SERVICE_ACCOUNT"
echo "payloads     ${targets[*]}"
echo

if [[ "${SEED_YES:-}" != "1" ]] && [[ " ${targets[*]} " != *" --dry-run "* ]]; then
  read -r -p "Write these payloads to PRODUCTION? [y/N] " reply
  if [[ "$reply" != "y" && "$reply" != "Y" ]]; then
    echo "aborted"
    exit 1
  fi
fi

cd "$FUNCTIONS_DIR"
exec node scripts/create-story-by-admin.js \
  "${targets[@]}" \
  --prod \
  --project="$PROJECT" \
  --admin-email="$ADMIN_EMAIL" \
  --owner-uid="$OWNER_UID" \
  --service-account="$SERVICE_ACCOUNT"
