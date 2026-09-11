/**
 * Published crawler IP prefix feeds — the raw material for `verification`.
 *
 * Every operator here serves the SAME document shape, which is not a coincidence:
 * Google published the format for Googlebot verification and OpenAI, Microsoft,
 * Anthropic and Perplexity all adopted it. So one parser covers all of them, and
 * a new operator is one line in `BOT_RANGE_FEEDS`.
 *
 *   { "creationTime": "...", "prefixes": [ { "ipv4Prefix": "1.2.3.0/24" },
 *                                          { "ipv6Prefix": "2001:db8::/32" } ] }
 *
 * The feed URLs are public and unauthenticated; if one starts 404ing the refresh
 * job reports a failure for that source and leaves the previous prefixes in
 * place (see `botRangesRefresh` in `jobs/bot-ranges-refresh.ts`).
 *
 * ## Why this is a job, and where the request path reads from
 *
 * Verification runs on every bot hit. Fetching every feed per request would be
 * absurd, and caching them in module scope would still mean a cold start pays for
 * it — on Vercel, frequently. So the `bot-ranges-refresh` job fetches the feeds
 * and writes them twice: to `analytics.bot_ip_ranges` (the record the admin panel
 * reads) and, per operator, to Redis (`publishBotRanges`). The request path reads
 * only the Redis copy (`publishedBotRanges`) — it must never touch Postgres, which
 * is the whole point of buffering bot hits (see `bot-hit-buffer.ts`).
 */

import { redis } from '$lib/server/cache';
import { isValidPrefix } from '$lib/server/db/analytics/inet';
import type { BotRangeSource } from '$lib/server/db/schema/analytics/bot-hits';
import { BOT_RANGES_CACHE_TTL_MS, BOT_RANGES_PROJECTION_KEY_PREFIX } from './config';

export interface BotRangeFeed {
	source: BotRangeSource;
	/** Several documents can back one source — OpenAI publishes one per crawler. */
	urls: readonly string[];
}

export const BOT_RANGE_FEEDS: readonly BotRangeFeed[] = [
	{
		source: 'openai',
		urls: [
			'https://openai.com/gptbot.json',
			'https://openai.com/chatgpt-user.json',
			'https://openai.com/searchbot.json',
		],
	},
	// One document covers ClaudeBot, Claude-User and Claude-SearchBot. Anthropic
	// previously stated it did not publish ranges at all; this endpoint replaced
	// that position, so treat a future shape change as plausible.
	{ source: 'anthropic', urls: ['https://claude.com/crawling/bots.json'] },
	{ source: 'google', urls: ['https://developers.google.com/static/search/apis/ipranges/googlebot.json'] },
	{ source: 'bing', urls: ['https://www.bing.com/toolbox/bingbot.json'] },
	{ source: 'perplexity', urls: ['https://www.perplexity.ai/perplexitybot.json'] },
];

/** Pull every prefix out of one feed document, ignoring entries we cannot use. */
export function parsePrefixes(payload: unknown): string[] {
	if (typeof payload !== 'object' || payload === null) return [];
	const prefixes = (payload as { prefixes?: unknown }).prefixes;
	if (!Array.isArray(prefixes)) return [];

	const out: string[] = [];
	for (const entry of prefixes) {
		if (typeof entry !== 'object' || entry === null) continue;
		const record = entry as { ipv4Prefix?: unknown; ipv6Prefix?: unknown };
		const value = typeof record.ipv4Prefix === 'string' ? record.ipv4Prefix : record.ipv6Prefix;
		if (typeof value === 'string' && isValidPrefix(value)) out.push(value);
	}
	return out;
}

/** Replace one operator's projected prefixes. Called by the refresh job after the Postgres swap. */
export async function publishBotRanges(source: BotRangeSource, prefixes: readonly string[]): Promise<void> {
	if (!redis) return;
	await redis.set(`${BOT_RANGES_PROJECTION_KEY_PREFIX}${source}`, prefixes);
	projected.delete(source);
}

const projected = new Map<BotRangeSource, { prefixes: readonly string[] | null; loadedAt: number }>();

/**
 * One operator's published prefixes as the request path sees them: the Redis
 * projection, held in-process for `BOT_RANGES_CACHE_TTL_MS` so a busy crawler costs
 * one Redis read per process per ten minutes, not one per hit.
 *
 * Null when nothing is published (the job has never run, or Redis is down), which the
 * verdict renders as `unchecked` — never as `spoofed`.
 */
export async function publishedBotRanges(source: BotRangeSource): Promise<readonly string[] | null> {
	const cached = projected.get(source);
	if (cached && Date.now() - cached.loadedAt < BOT_RANGES_CACHE_TTL_MS) return cached.prefixes;
	if (!redis) return null;

	let prefixes: readonly string[] | null = null;
	try {
		const stored = await redis.get<unknown>(`${BOT_RANGES_PROJECTION_KEY_PREFIX}${source}`);
		if (Array.isArray(stored)) prefixes = stored.filter((p): p is string => typeof p === 'string');
	} catch (err) {
		console.error(`[analytics] bot ranges for ${source} unavailable:`, err);
	}
	projected.set(source, { prefixes, loadedAt: Date.now() });
	return prefixes;
}
