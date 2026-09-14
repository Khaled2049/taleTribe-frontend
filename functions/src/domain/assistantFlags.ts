/** Server-owned switches. Frontend flags never authorize a capability. */
export function assistantFlags(env: NodeJS.ProcessEnv = process.env) {
  const api = env.ASSISTANT_API_ENABLED === "true";
  return {
    api,
    edits: api && env.ASSISTANT_EDIT_PROPOSALS_ENABLED === "true",
    research: api && env.ASSISTANT_RESEARCH_ENABLED === "true",
  };
}
