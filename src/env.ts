/**
 * Every environment variable the app reads, declared once (SvelteKit 3 `src/env.ts`).
 *
 * `$app/env/private` exports exactly what is listed here, nothing else, and SvelteKit validates
 * the values when the server starts. Each one is optional on purpose: the app reads them where
 * they are used and degrades or fails there (a missing Neo4j URI turns the graph showcase off,
 * a missing auth secret stops `auth/index.ts` at import). A variable without a schema would
 * instead abort the whole server at start-up, which is a behaviour change, not a migration.
 *
 * All are dynamic and private: read at runtime on the server, never inlined into a bundle and
 * never sent to the browser. Add a variable here before importing it; the import fails otherwise.
 */
import { defineEnvVars } from '@sveltejs/kit/env';

/** Unset stays `undefined`; the reading module decides what that means. */
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	// Auth and the secrets derived from it
	BETTER_AUTH_SECRET: { schema: optional },
	BETTER_AUTH_URL: { schema: optional },
	GITHUB_CLIENT_ID: { schema: optional },
	GITHUB_CLIENT_SECRET: { schema: optional },
	GOOGLE_CLIENT_ID: { schema: optional },
	GOOGLE_CLIENT_SECRET: { schema: optional },
	ADMIN_USER_ID: { schema: optional },
	ANALYTICS_VISITOR_SALT: { schema: optional },
	ANALYTICS_CONFIRM_SECRET: { schema: optional },
	BLOG_UPLOAD_TICKET_SECRET: { schema: optional },
	PAIRING_SECRET: { schema: optional },
	ENCRYPTION_KEY: { schema: optional },
	ENCRYPTION_KEY_PREVIOUS: { schema: optional },
	// Abuse controls
	ALTCHA_HMAC_KEY: { schema: optional },
	BOT_DETECTION_MODE: { schema: optional },
	// Databases and storage
	NEON_DATABASE_URL_PROD: { schema: optional },
	NEON_API_KEY: { schema: optional },
	NEON_PROJECT_ID: { schema: optional },
	NEON_DEV_BRANCH_ID: { schema: optional },
	NEON_PARENT_BRANCH_ID: { schema: optional },
	NEO4J_URI: { schema: optional },
	NEO4J_USERNAME: { schema: optional },
	NEO4J_PASSWORD: { schema: optional },
	NEO4J_DATABASE: { schema: optional },
	UPSTASH_REDIS_REST_URL: { schema: optional },
	UPSTASH_REDIS_REST_TOKEN: { schema: optional },
	UPSTASH_MGMT_API_KEY: { schema: optional },
	UPSTASH_EMAIL: { schema: optional },
	UPSTASH_DB_ID: { schema: optional },
	R2_ACCOUNT_ID: { schema: optional },
	R2_ACCESS_KEY_ID: { schema: optional },
	R2_SECRET_ACCESS_KEY: { schema: optional },
	R2_BUCKET_NAME: { schema: optional },
	CLOUDFLARE_ANALYTICS_TOKEN: { schema: optional },
	// Notification channels
	RESEND_API_KEY: { schema: optional },
	RESEND_FROM_EMAIL: { schema: optional },
	TELEGRAM_BOT_TOKEN: { schema: optional },
	TELEGRAM_BOT_USERNAME: { schema: optional },
	TELEGRAM_WEBHOOK_SECRET: { schema: optional },
	DISCORD_BOT_TOKEN: { schema: optional },
	DISCORD_CLIENT_ID: { schema: optional },
	DISCORD_CLIENT_SECRET: { schema: optional },
	VAPID_PUBLIC_KEY: { schema: optional },
	VAPID_PRIVATE_KEY: { schema: optional },
	VAPID_SUBJECT: { schema: optional },
	// MCP server
	MCP_ADMIN_TOKEN: { schema: optional },
	MCP_PRIVATE_TOKEN: { schema: optional },
	MCP_ALLOWED_ORIGINS: { schema: optional },
	MCP_SELF_TRAFFIC_TOKEN: { schema: optional },
	MCP_TELEMETRY_SALT: { schema: optional },
	// Jobs and cron
	CRON_SECRET: { schema: optional },
	JOBS_DEV_ENABLED: { schema: optional },
	JOB_INTERVAL_MS: { schema: optional },
	DELIVERY_INTERVAL_MS: { schema: optional },
	DBOPS_AUTO_REFRESH_ENABLED: { schema: optional },
	// Analytics, privacy and showcases
	ANALYTICS_DEV_TRACKING: { schema: optional },
	PRIVACY_CONTACT_EMAIL: { schema: optional },
	EXTERNAL_SERVICE_LOCAL_URL: { schema: optional },
	EXTERNAL_SERVICE_LOCAL_TOKEN: { schema: optional },
	EXTERNAL_SERVICE_REMOTE_URL: { schema: optional },
	EXTERNAL_SERVICE_REMOTE_TOKEN: { schema: optional },
	// Platform identity (set by the host, never by hand)
	NODE_ENV: { schema: optional },
	VERCEL: { schema: optional },
	VERCEL_ENV: { schema: optional },
	VERCEL_GIT_COMMIT_SHA: { schema: optional },
	FLY_APP_NAME: { schema: optional },
	RAILWAY_ENVIRONMENT: { schema: optional },
});
