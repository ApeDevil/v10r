// ── Auth ───────────────────────────────────────────────────────────────────────

/** Session lifetime in seconds (7 days) */
export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 7;

/** Refresh session if older than this (24 hours, seconds) */
export const SESSION_UPDATE_AGE = 60 * 60 * 24;

/** Cookie cache revalidation interval (5 minutes, seconds) */
export const SESSION_COOKIE_MAX_AGE = 60 * 5;

/** Magic link token expiry (seconds) */
export const MAGIC_LINK_EXPIRES_IN = 300;

/** Email OTP expiry (seconds) */
export const EMAIL_OTP_EXPIRES_IN = 300;

/** Email OTP max attempts before invalidation */
export const EMAIL_OTP_MAX_ATTEMPTS = 3;

/** Auth endpoint rate limit: requests per window */
export const AUTH_RATE_LIMIT_MAX = 5;

/** Auth endpoint rate limit: window duration */
export const AUTH_RATE_LIMIT_WINDOW = '60 s';

/**
 * OAuth callback rate limit: requests per window (per IP). More generous than
 * AUTH_RATE_LIMIT_MAX — a single login burns a callback GET on top of the
 * sign-in POST, and callbacks are already protected by Better Auth's one-time
 * OAuth state validation. This bucket is DoS hygiene, not brute-force defense.
 */
export const AUTH_CALLBACK_RATE_LIMIT_MAX = 10;

/** OAuth callback rate limit: window duration */
export const AUTH_CALLBACK_RATE_LIMIT_WINDOW = '60 s';

/** Issuer label shown in authenticator apps for TOTP enrollment */
export const TWO_FACTOR_ISSUER = 'Velociraptor';

/** Step-up freshness window: a TOTP/backup-code check satisfies gated actions for this long (seconds) */
export const STEPUP_TTL = 600;

/** Per-account 2FA verify rate limit: attempts per window */
export const STEPUP_VERIFY_RATE_LIMIT_MAX = 5;

/** Per-account 2FA verify rate limit: window duration */
export const STEPUP_VERIFY_RATE_LIMIT_WINDOW = '300 s';

// ── AI ─────────────────────────────────────────────────────────────────────────

/** Chat endpoint rate limit: requests per window */
export const AI_RATE_LIMIT_MAX = 20;

/** Chat endpoint rate limit: window duration */
export const AI_RATE_LIMIT_WINDOW = '60 s';

/** Chat endpoint rate limit: Redis key prefix */
export const AI_RATE_LIMIT_PREFIX = 'ratelimit:ai:chat';

/** Max tokens for chat responses */
export const AI_MAX_TOKENS = 2048;

/**
 * Daily AI token budget per user (input + output).
 * Caps cost-amplification abuse to ~$1-2/user/day on premium models.
 * Resets at UTC day boundary.
 */
export const AI_DAILY_TOKEN_CAP = 100_000;

// ── Retrieval ──────────────────────────────────────────────────────────────────

/**
 * Embedding model identity + chunk sizing live in the Vite-free `rag-shared/embed-config`
 * leaf so the standalone Bun ingestion scripts can import the SAME constants by relative
 * path (they can't resolve the `$lib` alias). Re-exported here so app import sites are
 * unchanged — this is the one source of truth; never re-declare these values.
 */
export {
	CHUNK_OVERLAP,
	EMBEDDING_DIMENSIONS,
	EMBEDDING_MODEL,
	EMBEDDING_MODEL_ID,
	PARAGRAPH_CHUNK_TARGET,
	SECTION_CHUNK_TARGET,
} from './rag-shared/embed-config';

// ── Docs corpus (project documentation RAG) ──────────────────────────────────

/**
 * Reserved system user that owns every ingested project-documentation row. Each
 * RAG retrieval query hard-filters `user_id`, so docs must be owned by a real,
 * stable user id the orchestrator can substitute when querying the docs corpus.
 */
export const SYSTEM_DOCS_USER_ID = 'system-docs';

/** Reserved llmwiki collection holding the project-documentation corpus. */
export const PROJECT_DOCS_COLLECTION_ID = 'project-docs';

/** Maximum chunks injected into prompt context */
export const MAX_CONTEXT_CHUNKS = 5;

/** Graph traversal hard limit (hops) */
export const MAX_GRAPH_HOPS = 2;

/** Reciprocal rank fusion constant */
export const RRF_K = 60;

/** Over-fetch multiplier for pre-fusion retrieval */
export const OVERFETCH_MULTIPLIER = 3;

/** Maximum total chunks across all documents */
export const MAX_TOTAL_CHUNKS = 10_000;

/** Maximum child chunks per document (limits LLM calls during ingestion) */
export const MAX_CHUNKS_PER_DOCUMENT = 50;

/** Ingest endpoint rate limit: requests per window */
export const INGEST_RATE_LIMIT_MAX = 5;

/** Ingest endpoint rate limit: window duration */
export const INGEST_RATE_LIMIT_WINDOW = '1h';

/** Search endpoint rate limit: requests per window */
export const SEARCH_RATE_LIMIT_MAX = 30;

/** Search endpoint rate limit: window duration */
export const SEARCH_RATE_LIMIT_WINDOW = '1m';

// ── Showcase ───────────────────────────────────────────────────────────────────

/** Max rows per showcase table */
export const MAX_SHOWCASE_ROWS = 50;

/** Max S3 objects in showcase namespace */
export const MAX_SHOWCASE_OBJECTS = 20;

/** Max S3 objects in blog namespace */
export const MAX_BLOG_ASSETS = 100;

/** Max blog image upload size (bytes, 10 MB) */
export const MAX_BLOG_UPLOAD_SIZE = 10 * 1024 * 1024;

/** Max blog 3D model upload size (bytes, 50 MB) */
export const MAX_BLOG_3D_UPLOAD_SIZE = 50 * 1024 * 1024;

/** Max conversations per user */
export const MAX_CONVERSATIONS_PER_USER = 200;

/** Conversation CRUD rate limit: requests per window */
export const CONV_RATE_LIMIT_MAX = 30;

/** Conversation CRUD rate limit: window duration */
export const CONV_RATE_LIMIT_WINDOW = '60 s';

/** Conversation CRUD rate limit: Redis key prefix */
export const CONV_RATE_LIMIT_PREFIX = 'ratelimit:ai:conversations';

/** Username check endpoint rate limit: requests per window */
export const USERNAME_CHECK_RATE_LIMIT_MAX = 20;

/** Username check endpoint rate limit: window duration */
export const USERNAME_CHECK_RATE_LIMIT_WINDOW = '60 s' as const;

// ── Jobs ───────────────────────────────────────────────────────────────────────

/** Default scheduler interval (3 hours, ms). Override with JOB_INTERVAL_MS env var. */
export const DEFAULT_JOB_INTERVAL_MS = 3 * 60 * 60 * 1000;

/** Delay before first scheduler run (ms) */
export const JOB_STARTUP_DELAY_MS = 5_000;

/** Log retention period (days) */
export const LOG_RETENTION_DAYS = 90;

/** Hard-delete soft-deleted desk files (+ cascaded spreadsheet/markdown) this many days after deletion. */
export const DESK_SOFT_DELETE_RETENTION_DAYS = 30;

/** Prune desk file revisions (undo/version history) older than this. */
export const DESK_REVISION_RETENTION_DAYS = 90;

/** Trim ai.conversation_step usage telemetry older than this. Admin cost/usage views read it → long window. */
export const AI_TELEMETRY_RETENTION_DAYS = 180;

/** Delete admin audit-log rows older than this. Append-only growth table → bound it, but keep a long (compliance-ish) window. */
export const AUDIT_RETENTION_DAYS = 365;

/**
 * Null out the caller-supplied columns of `mcp.call_log` after this many days.
 *
 * Minimise by COLUMN before minimising by row: the dimensional signal (tool, outcome, latency,
 * registry version) is not personal data and is what makes "did the miss rate drop after v1.3?"
 * answerable, whereas the retained query text may describe a third party's project and the trace id
 * only ever serves an incident lookup nobody will file after a month.
 */
export const MCP_QUERY_TEXT_RETENTION_DAYS = 30;

/**
 * Delete `mcp.call_log` rows older than this. Longer than the text window because by then a row
 * carries no free text and no identifier of any kind, and "did last quarter's gaps get fixed"
 * needs a quarter.
 */
export const MCP_TELEMETRY_RETENTION_DAYS = 90;

// ── Storage ────────────────────────────────────────────────────────────────────

/** Max file upload size (bytes, 2 MB) */
export const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;

/** Presigned URL expiry (seconds) */
export const PRESIGNED_URL_EXPIRY = 300;

// ── Image Metadata Reader ───────────────────────────────────────────────────────

/** Max original image upload size (bytes, 8 MB) — server-proxied; rejected before processing. */
export const MAX_IMAGE_UPLOAD_SIZE = 8 * 1024 * 1024;

/** Longest edge of the stored derivative (px). Strips EXIF + bounds vision token cost. */
export const IMAGE_MAX_DIMENSION = 1024;

/** Accepted image input types (sniffed by magic bytes, not just the declared MIME). */
export const IMAGE_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;

// ── Database ───────────────────────────────────────────────────────────────────

/** HNSW index: max connections per node */
export const HNSW_M = 16;

/** HNSW index: construction beam width */
export const HNSW_EF_CONSTRUCTION = 64;

// ── Graph ──────────────────────────────────────────────────────────────────────

/** Default Neo4j query timeout (ms) — for ingest/admin/background callers. */
export const GRAPH_TIMEOUT_MS = 30_000;

/**
 * Tight Neo4j timeout (ms) for USER-FACING graph reads on the request path
 * (retrieval tier-3 expansion + entity fetch). The 30s default is fine for ingest
 * but would block a chat/retrieval response for half a minute on a slow Aura Free
 * instance — cap interactive graph calls at 3s and degrade gracefully instead.
 */
export const USER_GRAPH_TIMEOUT_MS = 3000;

// ── Security ───────────────────────────────────────────────────────────────────

/** HSTS max-age (seconds, 2 years) */
export const HSTS_MAX_AGE = 63_072_000;

// ── Notifications ─────────────────────────────────────────────────────────

/** Notifications per page */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/** Archive read notifications after N days */
export const NOTIFICATION_ARCHIVE_DAYS = 30;

/** Hard-delete archived notifications after N days */
export const NOTIFICATION_DELETE_DAYS = 90;

/** SSE heartbeat interval (ms) */
export const SSE_HEARTBEAT_MS = 25_000;

/** Max SSE connections per user */
export const SSE_MAX_PER_USER = 3;

/** Delivery worker interval (ms) */
export const DEFAULT_DELIVERY_INTERVAL_MS = 15_000;

/**
 * Max delivery attempts before the row is dead-lettered.
 *
 * 5 rather than 3 because attempts are now spaced by exponential backoff: 3 would
 * cover only ~2.5 minutes of provider downtime, barely better than the ~30 seconds
 * the old immediate-requeue gave. 5 covers ~42 minutes.
 */
export const DELIVERY_MAX_ATTEMPTS = 5;

/** Deliveries claimed per drain tick. */
export const DELIVERY_BATCH_SIZE = 25;

/**
 * First retry delay (ms). MUST exceed DEFAULT_DELIVERY_INTERVAL_MS — a backoff
 * shorter than the poll interval is not a backoff, it is a rounding error.
 */
export const DELIVERY_RETRY_BASE_MS = 30_000;

/** Exponential growth factor per attempt: 30s → 2m → 8m → 32m. */
export const DELIVERY_RETRY_FACTOR = 4;

/** Backoff ceiling (ms). */
export const DELIVERY_RETRY_MAX_MS = 60 * 60_000;

/** Retry-delay jitter band (±fraction) so a recovered provider isn't hit by a herd. */
export const DELIVERY_RETRY_JITTER = 0.15;

/**
 * How long a claim is valid before the reaper may reclaim it.
 *
 * INVARIANT: must exceed the worst-case time to drain a whole claimed batch.
 * `attempted_at` is stamped once for the entire batch, so the last row of a batch
 * of DELIVERY_BATCH_SIZE does not begin sending until the previous 24 finished —
 * its lease clock has been running that whole time. With a 10s per-provider
 * timeout: 25 × 10s = 250s < 300s. Providers have no timeout yet, so this
 * invariant is currently aspirational — see the follow-ups in the workers doc.
 */
export const DELIVERY_CLAIM_LEASE_MS = 5 * 60_000;

// ── API Rate Limits ─────────────────────────────────────────────────────────

/** Notification mark-as-read rate limit: requests per window */
export const NOTIFICATION_RATE_LIMIT_MAX = 60;

/** Notification mark-as-read rate limit: window duration */
export const NOTIFICATION_RATE_LIMIT_WINDOW = '60 s';

/** API write operations rate limit: requests per window */
export const API_WRITE_RATE_LIMIT_MAX = 10;

/** API write operations rate limit: window duration */
export const API_WRITE_RATE_LIMIT_WINDOW = '60 s';

/** API read operations rate limit: requests per window */
export const API_READ_RATE_LIMIT_MAX = 30;

/** API read operations rate limit: window duration */
export const API_READ_RATE_LIMIT_WINDOW = '60 s';

/** SSE connection attempt rate limit: requests per window */
export const SSE_RATE_LIMIT_MAX = 10;

/** SSE connection attempt rate limit: window duration */
export const SSE_RATE_LIMIT_WINDOW = '60 s';

/** Blog write operations rate limit: requests per window */
export const BLOG_WRITE_RATE_LIMIT_PREFIX = 'ratelimit:blog:write';
export const BLOG_WRITE_RATE_LIMIT_MAX = 30;
export const BLOG_WRITE_RATE_LIMIT_WINDOW = '60 s' as const;

/** Blog preview rate limit (CPU-intensive): requests per window */
export const BLOG_PREVIEW_RATE_LIMIT_PREFIX = 'ratelimit:blog:preview';
export const BLOG_PREVIEW_RATE_LIMIT_MAX = 10;
export const BLOG_PREVIEW_RATE_LIMIT_WINDOW = '60 s' as const;

/** Style roll rate limit: requests per window */
export const STYLE_ROLL_RATE_LIMIT_PREFIX = 'ratelimit:style:roll';
export const STYLE_ROLL_RATE_LIMIT_MAX = 10;
export const STYLE_ROLL_RATE_LIMIT_WINDOW = '60 s' as const;

/**
 * Style pick rate limit. Deliberately far looser than the roll bucket: picking a
 * palette, a typography set and a shape is three requests, and comparing eight
 * palettes by clicking through them is eight more. Roll's budget of 10 would
 * reject ordinary browsing of the picker.
 */
export const STYLE_PICK_RATE_LIMIT_PREFIX = 'ratelimit:style:pick';
export const STYLE_PICK_RATE_LIMIT_MAX = 60;
export const STYLE_PICK_RATE_LIMIT_WINDOW = '60 s' as const;

/** Custom palette writes (create/update/delete), keyed per user. */
export const PALETTE_WRITE_RATE_LIMIT_PREFIX = 'ratelimit:style:palettes';
export const PALETTE_WRITE_RATE_LIMIT_MAX = 20;
export const PALETTE_WRITE_RATE_LIMIT_WINDOW = '60 s' as const;

/**
 * Per-user custom palette cap. Palette creation used to be admin-only and so had
 * no ceiling; now that any signed-in user can craft one, this bounds row growth.
 */
export const MAX_CUSTOM_PALETTES_PER_USER = 20;

// ── Feedback ──────────────────────────────────────────────────────────────────

/** Public feedback submission rate limit (per IP) */
export const FEEDBACK_RATE_LIMIT_PREFIX = 'rl:feedback:submit';
export const FEEDBACK_RATE_LIMIT_MAX = 3;
export const FEEDBACK_RATE_LIMIT_WINDOW = '1 h' as const;

// ── Analytics ─────────────────────────────────────────────────────────────────

/** Raw event retention period (days) */
export const ANALYTICS_RETENTION_DAYS = 60;

/** Consent record retention (days, ~13 months for GDPR Art. 7(1) demonstrability) */
export const CONSENT_RETENTION_DAYS = 395;

/** Aggregate rollup retention period (days) */
export const ANALYTICS_AGGREGATE_RETENTION_DAYS = 365;

/**
 * Authenticated-lane event retention (days).
 *
 * Longer than the anonymous lane's 60 days because the purpose differs: this
 * lane answers "how do our users actually use their account over time", which
 * needs enough history to see retention and seasonality. It is bounded all the
 * same — the rows are identified personal data, and Art 5(1)(e) does not stop
 * applying because the basis is legitimate interest. Erasure is separate and
 * immediate: deleting the account cascades these rows away regardless of age.
 */
export const ANALYTICS_USER_RETENTION_DAYS = 180;

/** Session inactivity timeout (ms, 30 min) */
export const ANALYTICS_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Consent cookie name */
export const ANALYTICS_CONSENT_COOKIE = 'v10r_consent';

/**
 * Analytics session cookie name. Only ever set at `analytics` consent or above —
 * it writes to terminal equipment and is not strictly necessary (TDDDG §25 /
 * ePrivacy Art 5(3)). Read by both the collector hook and the SPA beacon
 * endpoint, which is why it lives here rather than as a literal in either.
 */
export const ANALYTICS_SESSION_COOKIE = '_v10r_sid';

/** Consent cookie max-age (seconds, 6 months) */
export const ANALYTICS_CONSENT_MAX_AGE = 15_552_000;

// ── Admin ──────────────────────────────────────────────────────────────────────

// ADMIN_USER_ID gates admin access — a comma-separated list of admin user ids
// (one per admin; immutable, so admin can't be transferred by re-claiming an
// email). Read from $env/dynamic/private at usage sites to avoid top-level env
// access during build. See src/lib/server/auth/guards.ts (isAdmin).

/** Audit log entries per page */
export const ADMIN_AUDIT_PAGE_SIZE = 50;

/** Users per page in admin user management */
export const ADMIN_USERS_PAGE_SIZE = 25;

/** Announcement in-process cache TTL (ms) */
export const ADMIN_ANNOUNCEMENT_CACHE_TTL_MS = 30_000;

/** Delivery log entries per page in admin */
export const ADMIN_DELIVERY_PAGE_SIZE = 50;

/** AI conversations per page in admin */
export const ADMIN_AI_PAGE_SIZE = 25;

/** RAG documents per page in admin */
export const ADMIN_RAG_PAGE_SIZE = 25;

/** Cache keys per page in admin */
export const ADMIN_CACHE_PAGE_SIZE = 50;

/** Blog posts per page in admin */
export const ADMIN_BLOG_PAGE_SIZE = 25;
