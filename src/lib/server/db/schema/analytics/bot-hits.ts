/**
 * BOT HITS — the third collection lane: non-human traffic, recorded on purpose.
 *
 * The other two lanes describe people. This one describes software, and that
 * difference is why it is a separate table rather than a flag on
 * `analytics.events`.
 *
 * ## Why a separate table
 *
 * `analytics.events` rests on Art 6(1)(f), and that assessment is written on the
 * premise that its subjects are anonymous human visitors. A crawler is not a data
 * subject; it has no terminal equipment to protect, so TDDDG §25 / ePrivacy
 * Art 5(3) never engages and there is nothing to consent to. Folding bot rows in
 * would simultaneously corrupt every human metric (this is exactly how 2026-07-30
 * reported 114 "unique visitors" against Vercel's 3) and undermine the legal
 * narrative of the lane it contaminated.
 *
 * Same reasoning as `mcp.call_log`: no FK, no shared join key, no visitor hash.
 * There is deliberately NO identifier of any kind here — not even a keyed one.
 * The source IP is used ONCE, transiently, to answer "did this match the
 * operator's published range", and is never stored.
 *
 * ## What this lane is for
 *
 * Primarily AX: whether GPTBot / ClaudeBot / PerplexityBot actually fetch
 * `/llms.txt`, `/robots.txt` and the `.md` docs layer is direct evidence about
 * whether the agent-facing surfaces are worth maintaining. Vercel Web Analytics
 * structurally cannot answer it — its beacon needs JavaScript and crawlers do not
 * run any. Secondarily security: the `scanner` category and 4xx paths.
 *
 * MUST be re-exported from `schema/analytics/index.ts` — `db:push` silently drops
 * enums and tables it cannot reach from the schema index.
 */

import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { analyticsSchema } from './events';

/**
 * What the caller is FOR. Coarse on purpose — this is the axis operator decisions
 * are actually made on ("are AI agents reading the docs" / "am I being scanned"),
 * and a finer split would just be `family` with extra steps.
 */
export const botCategoryEnum = analyticsSchema.enum('bot_category', [
	'ai_training', //  corpus collection for model training (GPTBot, ClaudeBot, CCBot)
	'ai_search', //    answer-engine indexing (OAI-SearchBot, PerplexityBot)
	'ai_agent', //     fetching live, on behalf of a user right now (ChatGPT-User, Claude-User)
	'search', //       classic search indexing (Googlebot, Bingbot)
	'seo', //          commercial SEO crawlers (Ahrefs, Semrush)
	'social', //       link-preview unfurlers
	'monitor', //      uptime and synthetic checks
	'scanner', //      vulnerability probes and internet-wide measurement
	'tool', //         HTTP libraries driven by a human (curl, requests)
	'unclassified', // not browser-shaped, not recognised — see isBrowserNavigation
]);

/**
 * Whether the caller's claimed identity survived a check against the operator's
 * PUBLISHED IP ranges.
 *
 * The User-Agent is free text. Anyone can send `GPTBot`, and impersonating a
 * well-behaved crawler is the cheapest way to get privileged treatment from a
 * site. So the claim and the verdict are stored as separate columns and every
 * panel that shows `family` must read this alongside it.
 *
 * `spoofed` is the money value: it means the caller named a family whose ranges
 * we hold and its source IP was NOT in them. It is simultaneously the security
 * signal and the correction that stops the AX numbers from being flattering
 * fiction.
 */
export const botVerificationEnum = analyticsSchema.enum('bot_verification', [
	'verified', //    source IP matched the claimed operator's published range
	'spoofed', //     claimed a family we CAN check, and the IP did not match
	'unpublished', // that operator publishes no range list — unknowable, not suspicious
	'unchecked', //   ranges unavailable at write time (feed never fetched, or refresh failing)
]);

/** Operators that publish a machine-readable prefix list. One row per prefix. */
export const botRangeSourceEnum = analyticsSchema.enum('bot_range_source', [
	'openai',
	'anthropic',
	'google',
	'bing',
	'perplexity',
]);

export const botHits = analyticsSchema.table(
	'bot_hits',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),

		/**
		 * Normalised token from the User-Agent (`gptbot`, `claudebot`, `googlebot`, …),
		 * resolved through the classifier's closed list so cardinality is bounded by
		 * OUR table and not by caller text. Unrecognised callers collapse to `other`.
		 *
		 * SELF-ASSERTED. Never read without `verification`.
		 */
		family: text('family').notNull(),

		category: botCategoryEnum('category').notNull(),
		verification: botVerificationEnum('verification').notNull(),

		/** Templated route — the cardinality-bounded grouping key, as in `events`. */
		route: text('route'),

		/**
		 * Raw path, written ONLY where it is the signal and bounded elsewhere:
		 * agent surfaces (`/llms.txt`, `/robots.txt`, the `.md` docs layer) and
		 * misses (a scanner probing `/wp-admin`). Enforced by `bot_hit_path_scope`
		 * rather than by a caller's discipline — an unbounded path column fed by
		 * scanners is a cardinality bomb, and this is the same control `mcp.call_log`
		 * puts on `query_text`.
		 */
		path: text('path'),

		/** True for `/llms.txt`, `/robots.txt`, `/sitemap.xml` and `.md` docs responses. */
		agentSurface: boolean('agent_surface').notNull().default(false),

		/** Response status. The 4xx rows are the probes; the 200s on agent surfaces are the ROI. */
		status: integer('status').notNull(),

		timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('bot_hits_timestamp_idx').on(table.timestamp.desc()),
		index('bot_hits_family_timestamp_idx').on(table.family, table.timestamp.desc()),
		index('bot_hits_category_timestamp_idx').on(table.category, table.timestamp.desc()),
		// The AX question — "which agents fetch the agent surfaces" — as a partial
		// index, so it stays small no matter how much scanner noise arrives.
		index('bot_hits_agent_surface_idx').on(table.timestamp.desc()).where(sql`${table.agentSurface} = true`),

		// Raw path exists only where it carries signal. Everything else groups by route.
		check('bot_hit_path_scope', sql`${table.path} IS NULL OR ${table.agentSurface} = true OR ${table.status} >= 400`),
		check('bot_hit_path_len', sql`${table.path} IS NULL OR char_length(${table.path}) <= 128`),
		check('bot_hit_family_len', sql`char_length(${table.family}) <= 32`),
		check('bot_hit_status', sql`${table.status} BETWEEN 100 AND 599`),
	],
);

/**
 * Published crawler IP prefixes, refreshed by the `bot-ranges-refresh` job.
 *
 * The source of record for the admin "is verification current" panel and the seed.
 * The request path does NOT read it: verification runs in JS against a Redis
 * projection of these rows (`analytics/bot-ranges.ts` → `publishedBotRanges`),
 * because a per-hit Postgres round trip woke the database on every crawler request.
 * Stored as TEXT — roughly 750 rows across all operators, nothing to index.
 */
export const botIpRanges = analyticsSchema.table(
	'bot_ip_ranges',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		source: botRangeSourceEnum('source').notNull(),
		/** A single CIDR prefix, e.g. `20.171.207.0/24` or `2001:4860:4801:10::/64`. */
		prefix: text('prefix').notNull(),
		fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		unique('bot_ip_ranges_source_prefix_uniq').on(table.source, table.prefix),
		index('bot_ip_ranges_source_idx').on(table.source),
	],
);

export type BotHitRow = typeof botHits.$inferSelect;
export type BotHitInsert = typeof botHits.$inferInsert;
export type BotRangeSource = (typeof botRangeSourceEnum.enumValues)[number];
export type BotVerification = (typeof botVerificationEnum.enumValues)[number];
export type BotCategory = (typeof botCategoryEnum.enumValues)[number];
