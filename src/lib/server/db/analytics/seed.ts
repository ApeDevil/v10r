/**
 * Analytics seed data — deterministic synthetic data for the analytics showcase.
 * Uses a seeded PRNG (mulberry32) for reproducible results across environments.
 * No external dependencies — all randomness is self-contained.
 * TRUNCATE + INSERT pattern, callable from form action.
 */
import { sql } from 'drizzle-orm';
import type { Database } from '$lib/server/db';

/** mulberry32 — simple, fast, deterministic 32-bit PRNG */
function mulberry32(seed: number) {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

let rng = mulberry32(42);

function randInt(min: number, max: number): number {
	return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
	return arr[Math.floor(rng() * arr.length)];
}

function alphanumeric(len: number): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < len; i++) result += chars[Math.floor(rng() * chars.length)];
	return result;
}

const SESSION_COUNT = 500;
const DAYS_BACK = 90;

const PAGE_PATHS = [
	'/',
	'/pricing',
	'/docs',
	'/docs/getting-started',
	'/docs/api',
	'/blog',
	'/blog/release-v2',
	'/about',
	'/contact',
	'/signup',
] as const;

const REFERRERS = [
	null,
	'https://google.com',
	'https://twitter.com',
	'https://github.com',
	'https://reddit.com',
	'https://hn.algolia.com',
	'https://dev.to',
] as const;

const COUNTRIES = [
	{ code: 'US', weight: 35 },
	{ code: 'GB', weight: 12 },
	{ code: 'DE', weight: 8 },
	{ code: 'FR', weight: 7 },
	{ code: 'CA', weight: 6 },
	{ code: 'AU', weight: 5 },
	{ code: 'NL', weight: 4 },
	{ code: 'BR', weight: 4 },
	{ code: 'IN', weight: 4 },
	{ code: 'JP', weight: 3 },
	{ code: 'SE', weight: 3 },
	{ code: 'ES', weight: 3 },
	{ code: 'IT', weight: 3 },
	{ code: 'PL', weight: 3 },
] as const;

const DEVICES = [
	{ name: 'desktop', weight: 55 },
	{ name: 'mobile', weight: 40 },
	{ name: 'tablet', weight: 5 },
] as const;

const BROWSERS = [
	{ name: 'Chrome', weight: 65 },
	{ name: 'Safari', weight: 20 },
	{ name: 'Edge', weight: 11 },
	{ name: 'Firefox', weight: 4 },
] as const;

const CONSENT_TIERS = [
	{ tier: 'necessary', weight: 35 },
	{ tier: 'analytics', weight: 65 },
] as const;

const JOURNEY_TEMPLATES = [
	{ weight: 40, pages: ['/'] },
	{ weight: 5, pages: ['/blog'] },
	{ weight: 5, pages: ['/docs'] },
	{ weight: 10, pages: ['/', '/pricing'] },
	{ weight: 8, pages: ['/', '/docs', '/docs/getting-started'] },
	{ weight: 6, pages: ['/', '/docs', '/docs/api'] },
	{ weight: 5, pages: ['/blog', '/blog/release-v2', '/pricing'] },
	{ weight: 3, pages: ['/', '/about', '/contact'] },
	{ weight: 7, pages: ['/', '/pricing', '/signup'] },
	{ weight: 3, pages: ['/blog/release-v2', '/pricing', '/signup'] },
	{ weight: 2, pages: ['/', '/docs', '/pricing', '/signup'] },
	{ weight: 3, pages: ['/', '/docs', '/docs/getting-started', '/docs/api', '/pricing'] },
	{ weight: 3, pages: ['/', '/blog', '/blog/release-v2', '/docs', '/pricing', '/signup'] },
] as const;

const ACTION_EVENTS = [
	{ type: 'signup_click', path: '/pricing' as string | null, weight: 15 },
	{ type: 'cta_click', path: '/' as string | null, weight: 25 },
	{ type: 'form_submit', path: '/contact' as string | null, weight: 10 },
	{ type: 'doc_search', path: '/docs' as string | null, weight: 20 },
	{ type: 'copy_code', path: '/docs/api' as string | null, weight: 15 },
	{ type: 'theme_toggle', path: null as string | null, weight: 10 },
	{ type: 'share_click', path: '/blog/release-v2' as string | null, weight: 5 },
] as const;

function weightedPick<T extends { weight: number }>(items: readonly T[]): T {
	const total = items.reduce((sum, i) => sum + i.weight, 0);
	let r = randInt(0, total - 1);
	for (const item of items) {
		r -= item.weight;
		if (r < 0) return item;
	}
	return items[items.length - 1];
}

function diurnalTimestamp(baseDate: Date): Date {
	const isBusiness = randInt(0, 99) < 60;
	const hour = isBusiness ? randInt(9, 17) : randInt(0, 23);
	const minute = randInt(0, 59);
	const second = randInt(0, 59);
	const d = new Date(baseDate);
	d.setUTCHours(hour, minute, second, 0);
	return d;
}

/** Seed-shaped stand-in for the real keyed hash — same `v1_` + 32-hex format. */
function hashVisitorId(seed: number): string {
	return `v1_${seed.toString(16).padStart(32, '0')}`;
}

function formatTimestamp(d: Date): string {
	return d.toISOString().replace('T', ' ').replace('Z', '+00');
}

export async function reseedAnalytics(database: Database) {
	// Reset PRNG for deterministic output
	rng = mulberry32(42);

	await database.execute(sql`
		TRUNCATE
			analytics.daily_page_stats,
			analytics.events,
			analytics.sessions,
			analytics.bot_hits
		RESTART IDENTITY CASCADE
	`);

	const now = new Date();
	const startDate = new Date(now);
	startDate.setDate(startDate.getDate() - DAYS_BACK);

	const visitorCount = Math.floor(SESSION_COUNT * 0.6);
	const visitorIds = Array.from({ length: visitorCount }, (_, i) => hashVisitorId(i));

	const sessionRows: string[] = [];
	const eventRows: string[] = [];

	for (let i = 0; i < SESSION_COUNT; i++) {
		const sessionId = `s_${alphanumeric(16)}`;
		const visitorId = pick(visitorIds);
		const journey = weightedPick(JOURNEY_TEMPLATES);
		const consent = weightedPick(CONSENT_TIERS);
		const device = weightedPick(DEVICES);
		const browser = weightedPick(BROWSERS);
		const country = weightedPick(COUNTRIES);

		const dayOffset = randInt(0, DAYS_BACK - 1);
		const sessionDate = new Date(startDate);
		sessionDate.setDate(sessionDate.getDate() + dayOffset);
		const sessionStart = diurnalTimestamp(sessionDate);

		const pages = journey.pages;
		const entryPath = pages[0];
		const exitPath = pages[pages.length - 1];
		const isBounce = pages.length === 1;

		const durationMs = isBounce ? randInt(5000, 30000) : randInt(30000, 600000);
		const sessionEnd = new Date(sessionStart.getTime() + durationMs);

		const hasAnalyticsConsent = consent.tier !== 'necessary';
		const deviceVal = hasAnalyticsConsent ? `'${device.name}'` : 'NULL';
		const browserVal = hasAnalyticsConsent ? `'${browser.name}'` : 'NULL';
		const countryVal = hasAnalyticsConsent ? `'${country.code}'` : 'NULL';

		// Confirmation mirrors production shape: consented sessions almost always
		// confirm (their beacons double as corroboration); necessary-tier sessions
		// confirm via the consent-free ping, minus blocker/no-JS loss — and the
		// unconfirmed remainder is what the composition panel's crawler bucket shows.
		const isConfirmed = hasAnalyticsConsent ? randInt(0, 99) < 90 : randInt(0, 99) < 40;
		const confirmedVal = isConfirmed ? `'${formatTimestamp(sessionStart)}'` : 'NULL';

		sessionRows.push(
			`('${sessionId}', '${visitorId}', '${formatTimestamp(sessionStart)}', '${formatTimestamp(sessionEnd)}', ${pages.length}, '${entryPath}', '${exitPath}', ${deviceVal}, ${browserVal}, ${countryVal}, '${consent.tier}', ${confirmedVal})`,
		);

		let eventTime = new Date(sessionStart);
		for (let j = 0; j < pages.length; j++) {
			const page = pages[j];
			const referrer = j === 0 ? pick(REFERRERS) : pages[j - 1];
			const refVal = referrer ? `'${referrer}'` : 'NULL';

			eventRows.push(
				`('${sessionId}', '${visitorId}', 'pageview', '${page}', ${refVal}, NULL, '${consent.tier}', '${formatTimestamp(eventTime)}')`,
			);

			if (j < pages.length - 1) {
				eventTime = new Date(eventTime.getTime() + randInt(3000, Math.floor(durationMs / pages.length)));
			}
		}
	}

	// Generate custom action events (~200)
	for (let i = 0; i < 200; i++) {
		const action = weightedPick(ACTION_EVENTS);
		const consent = weightedPick(CONSENT_TIERS);
		const visitorId = pick(visitorIds);
		const sessionId = `s_${alphanumeric(16)}`;
		const dayOffset = randInt(0, DAYS_BACK - 1);
		const actionDate = new Date(startDate);
		actionDate.setDate(actionDate.getDate() + dayOffset);
		const actionTime = diurnalTimestamp(actionDate);
		const path = action.path ?? pick(PAGE_PATHS as unknown as string[]);

		const metadata = JSON.stringify({ action: action.type }).replace(/'/g, "''");

		eventRows.push(
			`('${sessionId}', '${visitorId}', 'action', '${path}', NULL, '${metadata}'::jsonb, '${consent.tier}', '${formatTimestamp(actionTime)}')`,
		);
	}

	// Batch insert sessions
	const SESSION_BATCH = 100;
	for (let i = 0; i < sessionRows.length; i += SESSION_BATCH) {
		const batch = sessionRows.slice(i, i + SESSION_BATCH);
		await database.execute(
			sql.raw(`
			INSERT INTO analytics.sessions
				(id, visitor_id, started_at, ended_at, page_count, entry_path, exit_path, device, browser, country, consent_tier, human_confirmed_at)
			VALUES
				${batch.join(',\n\t\t\t\t')}
		`),
		);
	}

	// Batch insert events
	const EVENT_BATCH = 200;
	for (let i = 0; i < eventRows.length; i += EVENT_BATCH) {
		const batch = eventRows.slice(i, i + EVENT_BATCH);
		await database.execute(
			sql.raw(`
			INSERT INTO analytics.events
				(session_id, visitor_id, event_type, path, referrer, metadata, consent_tier, timestamp)
			VALUES
				${batch.join(',\n\t\t\t\t')}
		`),
		);
	}

	// Compute daily page stats from events. Headline columns count CONFIRMED
	// sessions only, matching the real rollup's semantics (aggregates.ts doc);
	// the duration/bounce formulas here remain the seed's own simplified ones.
	await database.execute(sql`
		INSERT INTO analytics.daily_page_stats
			(date, path, unique_visitors, pageviews, unconfirmed_pageviews, avg_duration_ms, bounce_rate)
		SELECT
			-- ::date, not to_char: the target column is a DATE, and text does not
			-- assignment-cast into it — the to_char version threw 42804 on insert.
			e.timestamp::date AS date,
			e.path,
			COUNT(DISTINCT e.visitor_id) FILTER (WHERE s.human_confirmed_at IS NOT NULL) AS unique_visitors,
			COUNT(*) FILTER (WHERE s.human_confirmed_at IS NOT NULL) AS pageviews,
			COUNT(*) FILTER (WHERE s.human_confirmed_at IS NULL) AS unconfirmed_pageviews,
			COALESCE(
				AVG(
					CASE WHEN s.page_count > 1 AND s.human_confirmed_at IS NOT NULL
						THEN EXTRACT(EPOCH FROM (s.ended_at - s.started_at))::integer * 1000 / s.page_count
						ELSE NULL
					END
				)::integer,
				0
			) AS avg_duration_ms,
			CASE
				WHEN COUNT(*) FILTER (WHERE s.human_confirmed_at IS NOT NULL) = 0 THEN 0
				ELSE (
					COUNT(*) FILTER (WHERE s.page_count = 1 AND s.human_confirmed_at IS NOT NULL) * 100
					/ COUNT(*) FILTER (WHERE s.human_confirmed_at IS NOT NULL)
				)
			END AS bounce_rate
		FROM analytics.events e
		JOIN analytics.sessions s ON s.id = e.session_id
		WHERE e.event_type = 'pageview'
		GROUP BY e.timestamp::date, e.path
		ORDER BY date, path
	`);

	// A small bot lane so the composition panel and the bots page have something to
	// show after a reseed. Zeros against a freshly seeded human lane read as "no
	// crawlers exist".
	const botRows: string[] = [];
	const BOT_SEED: Array<{
		family: string;
		category: string;
		verification: string;
		weight: number;
	}> = [
		{ family: 'claudebot', category: 'ai_training', verification: 'verified', weight: 30 },
		{ family: 'gptbot', category: 'ai_training', verification: 'verified', weight: 15 },
		{ family: 'chatgpt-user', category: 'ai_agent', verification: 'verified', weight: 5 },
		{ family: 'googlebot', category: 'search', verification: 'verified', weight: 10 },
		{ family: 'semrush', category: 'seo', verification: 'unpublished', weight: 15 },
		{ family: 'other', category: 'unclassified', verification: 'unpublished', weight: 25 },
	];
	for (let i = 0; i < 150; i++) {
		const bot = weightedPick(BOT_SEED);
		const dayOffset = randInt(0, DAYS_BACK - 1);
		const hitDate = new Date(startDate);
		hitDate.setDate(hitDate.getDate() + dayOffset);
		const hitTime = diurnalTimestamp(hitDate);

		// Respect bot_hit_path_scope: path only for agent surfaces and misses.
		const roll = randInt(0, 99);
		const isAgentSurface = roll < 20;
		const isMiss = !isAgentSurface && roll < 30;
		const status = isMiss ? 404 : 200;
		const pathVal = isAgentSurface ? "'/llms.txt'" : isMiss ? "'/wp-admin'" : 'NULL';
		const routeVal = isAgentSurface || isMiss ? 'NULL' : "'/blog'";

		botRows.push(
			`('${bot.family}', '${bot.category}', '${bot.verification}', ${routeVal}, ${pathVal}, ${isAgentSurface}, ${status}, '${formatTimestamp(hitTime)}')`,
		);
	}
	await database.execute(
		sql.raw(`
		INSERT INTO analytics.bot_hits
			(family, category, verification, route, path, agent_surface, status, timestamp)
		VALUES
			${botRows.join(',\n\t\t\t')}
	`),
	);
}
