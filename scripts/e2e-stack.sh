#!/usr/bin/env bash
#
# Bring up the full NovelSync stack against local emulators and run the Cypress
# E2E suite headlessly, then tear everything down. Mirrors story/dev.sh but is
# non-interactive and CI-friendly.
#
#   Firestore emulator : 8080      creditProxy gateway : 8090 (mock LLM)
#   Auth emulator      : 9099      agent (FastAPI)      : 8000
#   Functions emulator : 5001      Vite dev server      : 5173
#   story-data API     : 8084      story-data PostgreSQL: 5433
#
# Usage:
#   ./scripts/e2e-stack.sh                 # run all specs headless
#   ./scripts/e2e-stack.sh --open          # leave stack up + open Cypress UI
#   CYPRESS_SPEC=cypress/e2e/ai_chat.cy.ts ./scripts/e2e-stack.sh
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOS_DIR="$(cd "$FRONTEND_DIR/.." && pwd)"
AGENTS_DIR="$REPOS_DIR/taleTribe-agents"
STORY_DATA_DIR="$REPOS_DIR/story-data"
CREDIT_DIR="$REPOS_DIR/creditProxy"

CREDIT_PROXY_PORT="${CREDIT_PROXY_PORT:-8090}"
STORY_DATA_URL="${STORY_DATA_URL:-http://127.0.0.1:8084}"
OPEN_MODE="false"
[ "${1:-}" = "--open" ] && OPEN_MODE="true"

PIDS=()
STARTED_CREDIT="false"      # only tear down docker if we brought it up
STARTED_STORY_DATA="false"

cleanup() {
  echo ""
  echo "Shutting down E2E stack..."
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  if [ "$STARTED_STORY_DATA" = "true" ]; then
    (cd "$STORY_DATA_DIR" && docker compose down 2>/dev/null || true)
  fi
  if [ "$STARTED_CREDIT" = "true" ]; then
    (cd "$CREDIT_DIR" && CREDIT_PROXY_PORT="$CREDIT_PROXY_PORT" docker compose \
      -f docker-compose.yml -f docker-compose.override.yml down 2>/dev/null || true)
  fi
}
trap cleanup EXIT

require_dir() {
  [ -d "$1" ] || { echo "Error: $2 directory not found at $1." >&2; exit 1; }
}
require_dir "$AGENTS_DIR" "taleTribe-agents"
require_dir "$STORY_DATA_DIR" "story-data"
require_dir "$CREDIT_DIR" "creditProxy"

# Returns 0 if the service is already responding (reuse it, don't start a new one).
is_up() {
  curl -sf "$1" >/dev/null 2>&1
}

wait_for() {
  local url="$1" label="$2" tries="${3:-120}"
  echo "Waiting for $label..."
  until curl -sf "$url" >/dev/null 2>&1; do
    tries=$((tries - 1))
    [ "$tries" -le 0 ] && { echo "Timed out waiting for $label ($url)"; exit 1; }
    sleep 1
  done
  echo "$label ready."
}

# 1. story-data — PostgreSQL/pgvector on :5433, API on :8084. The API migrates
#    at startup, so a fresh volume is ready as soon as /health answers.
if is_up "$STORY_DATA_URL/health"; then
  echo "story-data already up on :8084 — reusing it."
else
  echo "Starting story-data (PostgreSQL + API)..."
  STARTED_STORY_DATA="true"
  (cd "$STORY_DATA_DIR" && docker compose up --build -d)
  wait_for "$STORY_DATA_URL/health" "story-data API"
fi

# 2. creditProxy — gateway on :8090 (avoids the Firestore emulator's :8080),
#    LLM_PROVIDER=mock => deterministic, key-free generations.
if is_up "http://localhost:$CREDIT_PROXY_PORT/health"; then
  echo "creditProxy already up on :$CREDIT_PROXY_PORT — reusing it."
else
  echo "Starting creditProxy (mock LLM) on :$CREDIT_PROXY_PORT..."
  STARTED_CREDIT="true"
  CREDIT_PROXY_PORT="$CREDIT_PROXY_PORT" LLM_PROVIDER=mock docker compose \
    -f "$CREDIT_DIR/docker-compose.yml" \
    -f "$CREDIT_DIR/docker-compose.override.yml" \
    up --build -d
  wait_for "http://localhost:$CREDIT_PROXY_PORT/health" "creditProxy gateway"
fi

# 3. Firebase emulators (functions/firestore/auth/storage + UI on :4000).
if is_up "http://localhost:4000"; then
  echo "Firebase emulators already up on :4000 — reusing them."
else
  echo "Starting Firebase emulators..."
  (cd "$FRONTEND_DIR" && yarn start:emulator) &
  PIDS+=($!)
  wait_for "http://localhost:4000" "Firebase emulators"
fi

# 4. taleTribe-agents — USE_MOCK=true keeps embeddings deterministic/offline;
#    AGENT_SERVICE_URL on the functions side defaults to localhost:8000.
if is_up "http://localhost:8000/health"; then
  echo "taleTribe-agents already up on :8000 — reusing it."
else
  echo "Starting taleTribe-agents on :8000..."
  (
    cd "$AGENTS_DIR"
    # The venv interpreter is invoked directly rather than through `activate`,
    # whose VIRTUAL_ENV is an absolute path baked in at creation time and so
    # breaks whenever the checkout moves.
    AGENT_PYTHON="python3"
    [ -x venv/bin/python ] && AGENT_PYTHON="$PWD/venv/bin/python"
    CREDIT_PROXY_URL="http://localhost:$CREDIT_PROXY_PORT" \
    GOOGLE_CLOUD_PROJECT=story-6f89f \
    USE_MOCK=true \
    FIRESTORE_EMULATOR_HOST=localhost:8080 \
    STORY_DATA_DATABASE_URL='postgres://postgres:postgres@localhost:5433/story_data?sslmode=disable' \
    INDEXING_WORKER_ENABLED=true \
    CORS_ORIGINS='["http://localhost:5173"]' \
    "$AGENT_PYTHON" server.py
  ) &
  PIDS+=($!)
  wait_for "http://localhost:8000/health" "taleTribe-agents"
fi

# 5. Vite dev server (development mode => Firebase Web SDK wires to emulators).
if is_up "http://localhost:5173"; then
  echo "Vite dev server already up on :5173 — reusing it."
else
  echo "Starting Vite dev server on :5173..."
  (cd "$FRONTEND_DIR" && yarn dev) &
  PIDS+=($!)
  wait_for "http://localhost:5173" "Vite dev server"
fi

# 6. Cypress.
cd "$FRONTEND_DIR"
if [ "$OPEN_MODE" = "true" ]; then
  echo "Stack is up. Opening Cypress UI (Ctrl+C to tear down)..."
  yarn cy:open
else
  if [ -n "${CYPRESS_SPEC:-}" ]; then
    yarn cy:run --spec "$CYPRESS_SPEC"
  else
    yarn cy:run
  fi
fi
