/**
 * Versioned assistant protocol, TypeScript side.
 *
 * Canonical definition lives in taleTribe-agents (`assistant/`); the fixtures in
 * `./fixtures` are vendored copies checked against a SHA-256 manifest by
 * `scripts/sync_assistant_fixtures.py --check` in that repository.
 */
export * from "./capabilities";
export * from "./events";
export * from "./protocol";
export * from "./stream";
