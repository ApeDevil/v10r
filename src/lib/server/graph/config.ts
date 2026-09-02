/**
 * Neo4j timeouts. Two, because an interactive read and a background ingest have very
 * different tolerances.
 */

/** Default Neo4j query timeout (ms) — for ingest/admin/background callers. */
export const TIMEOUT_MS = 30_000;

/**
 * Tight Neo4j timeout (ms) for USER-FACING graph reads on the request path
 * (retrieval tier-3 expansion + entity fetch). The 30s default is fine for ingest
 * but would block a chat/retrieval response for half a minute on a slow Aura Free
 * instance — cap interactive graph calls at 3s and degrade gracefully instead.
 */
export const USER_TIMEOUT_MS = 3000;
