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

// ── AI ─────────────────────────────────────────────────────────────────────────

/** Chat endpoint rate limit: requests per window */
export const AI_RATE_LIMIT_MAX = 20;

/** Chat endpoint rate limit: window duration */
export const AI_RATE_LIMIT_WINDOW = '60 s';

/** Chat endpoint rate limit: Redis key prefix */
export const AI_RATE_LIMIT_PREFIX = 'ratelimit:ai:chat';

/** Max tokens for chat responses */
export const AI_MAX_TOKENS = 2048;

// ── Retrieval ──────────────────────────────────────────────────────────────────

/** Embedding model identifier */
export const EMBEDDING_MODEL = 'gemini-embedding-001';

/** Embedding vector dimensions */
export const EMBEDDING_DIMENSIONS = 1536;

/** Embedding model row ID */
export const EMBEDDING_MODEL_ID = 'google-gemini-embedding-001';

/** Section-level chunk target (approximate tokens) */
export const SECTION_CHUNK_TARGET = 1000;

/** Paragraph-level chunk target (approximate tokens) */
export const PARAGRAPH_CHUNK_TARGET = 300;

/** Token overlap between chunks */
export const CHUNK_OVERLAP = 50;

/** Maximum chunks injected into prompt context */
export const MAX_CONTEXT_CHUNKS = 5;

/** Graph traversal hard limit (hops) */
export const MAX_GRAPH_HOPS = 2;

/** Reciprocal rank fusion constant */
export const RRF_K = 60;

/** Over-fetch multiplier for pre-fusion retrieval */
export const OVERFETCH_MULTIPLIER = 3;

/** Maximum documents per user */
export const MAX_DOCUMENTS_PER_USER = 100;

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

/** Max Redis keys in showcase namespace */
export const MAX_SHOWCASE_KEYS = 50;

/** Max S3 objects in showcase namespace */
export const MAX_SHOWCASE_OBJECTS = 20;

/** Max S3 objects in blog namespace */
export const MAX_BLOG_ASSETS = 100;

/** Max blog image upload size (bytes, 10 MB) */
export const MAX_BLOG_UPLOAD_SIZE = 10 * 1024 * 1024;

/** Max blog 3D model upload size (bytes, 50 MB) */
export const MAX_BLOG_3D_UPLOAD_SIZE = 50 * 1024 * 1024;

/** Max conversations per user */
export const MAX_CONVERSATIONS_PER_USER = 50;

/** Conversation CRUD rate limit: requests per window */
export const CONV_RATE_LIMIT_MAX = 30;

/** Conversation CRUD rate limit: window duration */
export const CONV_RATE_LIMIT_WINDOW = '60 s';

/** Conversation CRUD rate limit: Redis key prefix */
export const CONV_RATE_LIMIT_PREFIX = 'ratelimit:ai:conversations';

/** Username check endpoint rate limit: requests per window */
export const USERNAME_CHECK_RATE_LIMIT_MAX = 20;

/** Username check endpoint rate limit: window (ms) */
export const USERNAME_CHECK_RATE_LIMIT_WINDOW_MS = 60_000;

// ── Jobs ───────────────────────────────────────────────────────────────────────

/** Default scheduler interval (3 hours, ms). Override with JOB_INTERVAL_MS env var. */
export const DEFAULT_JOB_INTERVAL_MS = 3 * 60 * 60 * 1000;

/** Delay before first scheduler run (ms) */
export const JOB_STARTUP_DELAY_MS = 5_000;

/** Log retention period (days) */
export const LOG_RETENTION_DAYS = 90;

// ── Storage ────────────────────────────────────────────────────────────────────

/** Max file upload size (bytes, 2 MB) */
export const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;

/** Presigned URL expiry (seconds) */
export const PRESIGNED_URL_EXPIRY = 300;

// ── Database ───────────────────────────────────────────────────────────────────

/** HNSW index: max connections per node */
export const HNSW_M = 16;

/** HNSW index: construction beam width */
export const HNSW_EF_CONSTRUCTION = 64;

// ── Graph ──────────────────────────────────────────────────────────────────────

/** Default Neo4j query timeout (ms) */
export const GRAPH_TIMEOUT_MS = 30_000;

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

/** Max delivery attempts before giving up */
export const DELIVERY_MAX_ATTEMPTS = 3;

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

// ── Analytics ─────────────────────────────────────────────────────────────────

/** Raw event retention period (days) */
export const ANALYTICS_RETENTION_DAYS = 90;

/** Aggregate rollup retention period (days) */
export const ANALYTICS_AGGREGATE_RETENTION_DAYS = 365;

/** Session inactivity timeout (ms, 30 min) */
export const ANALYTICS_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Consent cookie name */
export const ANALYTICS_CONSENT_COOKIE = 'v10r_consent';

/** Consent cookie max-age (seconds, 6 months) */
export const ANALYTICS_CONSENT_MAX_AGE = 15_552_000;

// ── Admin ──────────────────────────────────────────────────────────────────────

// ADMIN_EMAIL is read from $env/dynamic/private at usage sites to avoid
// top-level env access during build. See src/lib/server/auth/guards.ts.

/** Audit log entries per page */
export const ADMIN_AUDIT_PAGE_SIZE = 50;

/** Users per page in admin user management */
export const ADMIN_USERS_PAGE_SIZE = 25;

/** Feature flag in-process cache TTL (ms) */
export const ADMIN_FLAG_CACHE_TTL_MS = 30_000;

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
