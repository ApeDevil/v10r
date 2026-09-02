/**
 * The bot lane's write path: a Redis list, drained into `analytics.bot_hits` in batches.
 *
 * ## Why not INSERT per hit
 *
 * Crawlers arrive around the clock — 130 to 4,600 hits a day in August 2026, most of
 * them at night — and every INSERT woke the Neon endpoint, which then stayed up for its
 * 5-minute minimum. That was ~30 wakes a night with nobody on the site and a real share
 * of the month's compute quota. The human lanes are unchanged: a visitor's page load
 * already queries the database, so their writes ride a compute that is awake anyway.
 *
 * ## What is buffered
 *
 * The finished row. Verification is computed HERE, at buffer time, against the prefixes
 * the `bot-ranges-refresh` job publishes to Redis (`publishedBotRanges`), so the source
 * IP is compared once and never enters the buffer — the same lifetime contract the
 * per-hit INSERT had.
 *
 * ## Draining
 *
 * `flushBotHits` runs from the `bot-hits-flush` job (daily, inside the due-jobs cron)
 * and from the admin bots page, so a human looking at the numbers always sees them
 * current. At-least-once: a batch is read, inserted, then trimmed; a crash between
 * insert and trim replays that one batch on the next flush. Duplicated counts for one
 * batch beat lost ones for a lane whose only readers are dashboards.
 */

import { redis } from '$lib/server/cache';
import { insertBotHits } from '$lib/server/db/analytics/bot-mutations';
import {
	type BotCategory,
	type BotHitInsert,
	type BotVerification,
	botCategoryEnum,
	botVerificationEnum,
} from '$lib/server/db/schema/analytics/bot-hits';
import type { BotIdentity } from './bot-classify';
import { publishedBotRanges } from './bot-ranges';
import { verifyBotIdentity } from './bot-verification';
import { BOT_HIT_BUFFER_CAP, BOT_HIT_BUFFER_KEY, BOT_HIT_FLUSH_BATCH, MAX_BOT_PATH_CHARS } from './config';

export interface BotHitInput {
	identity: BotIdentity;
	/** Used only for the containment test. Never buffered, never written. */
	ip: string | null;
	route: string | null;
	path: string | null;
	agentSurface: boolean;
	status: number;
}

/** One hit as it sits in Redis. Plain JSON — the list outlives any single deploy. */
interface BufferedBotHit {
	family: string;
	category: BotCategory;
	verification: BotVerification;
	route: string | null;
	path: string | null;
	agentSurface: boolean;
	status: number;
	/** ISO-8601, so the flushed row keeps the hit's real time, not the flush time. */
	timestamp: string;
}

const CATEGORIES = new Set<string>(botCategoryEnum.enumValues);
const VERIFICATIONS = new Set<string>(botVerificationEnum.enumValues);

let warnedUnconfigured = false;

export async function bufferBotHit({ identity, ip, route, path, agentSurface, status }: BotHitInput): Promise<void> {
	if (!redis) {
		// Never fall back to Postgres: that is the wake this module exists to remove.
		if (!warnedUnconfigured) {
			console.error('[analytics] bot hits are dropped — Upstash Redis is not configured');
			warnedUnconfigured = true;
		}
		return;
	}

	const verification = await verifyBotIdentity(identity, ip, publishedBotRanges);

	// Mirrors `bot_hit_path_scope`: the raw path is kept only where it is the signal.
	const storedPath = agentSurface || status >= 400 ? (path?.slice(0, MAX_BOT_PATH_CHARS) ?? null) : null;

	const hit: BufferedBotHit = {
		family: identity.family,
		category: identity.category,
		verification,
		route,
		path: storedPath,
		agentSurface,
		status,
		timestamp: new Date().toISOString(),
	};
	await redis.rpush(BOT_HIT_BUFFER_KEY, hit);
}

/** A buffered entry is third-party-shaped data by the time it is read back; check it. */
function toRow(entry: unknown): BotHitInsert | null {
	if (typeof entry !== 'object' || entry === null) return null;
	const hit = entry as Partial<BufferedBotHit>;
	if (typeof hit.family !== 'string' || hit.family.length === 0 || hit.family.length > 32) return null;
	if (typeof hit.category !== 'string' || !CATEGORIES.has(hit.category)) return null;
	if (typeof hit.verification !== 'string' || !VERIFICATIONS.has(hit.verification)) return null;
	if (typeof hit.status !== 'number' || hit.status < 100 || hit.status > 599) return null;
	const timestamp = typeof hit.timestamp === 'string' ? new Date(hit.timestamp) : new Date(Number.NaN);
	if (Number.isNaN(timestamp.getTime())) return null;
	return {
		family: hit.family,
		category: hit.category,
		verification: hit.verification,
		route: typeof hit.route === 'string' ? hit.route : null,
		path: typeof hit.path === 'string' ? hit.path.slice(0, MAX_BOT_PATH_CHARS) : null,
		agentSurface: hit.agentSurface === true,
		status: hit.status,
		timestamp,
	};
}

/**
 * Move everything buffered into `analytics.bot_hits`. Returns the number of entries
 * taken off the list (malformed entries are dropped and counted, never re-queued).
 */
export async function flushBotHits(): Promise<number> {
	if (!redis) return 0;

	const backlog = await redis.llen(BOT_HIT_BUFFER_KEY);
	if (backlog > BOT_HIT_BUFFER_CAP) {
		console.warn(
			`[analytics] bot-hit backlog ${backlog} over cap — dropping the oldest ${backlog - BOT_HIT_BUFFER_CAP}`,
		);
		await redis.ltrim(BOT_HIT_BUFFER_KEY, backlog - BOT_HIT_BUFFER_CAP, -1);
	}

	let flushed = 0;
	for (;;) {
		const entries = await redis.lrange<unknown>(BOT_HIT_BUFFER_KEY, 0, BOT_HIT_FLUSH_BATCH - 1);
		if (entries.length === 0) break;

		const rows = entries.map(toRow).filter((row): row is BotHitInsert => row !== null);
		if (rows.length > 0) await insertBotHits(rows);
		// Only now is it safe to forget them. LTRIM takes the head, so hits pushed
		// concurrently onto the tail are untouched.
		await redis.ltrim(BOT_HIT_BUFFER_KEY, entries.length, -1);

		flushed += entries.length;
		if (entries.length < BOT_HIT_FLUSH_BATCH) break;
	}
	return flushed;
}
