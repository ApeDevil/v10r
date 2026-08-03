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
 * All six URLs were verified live on 2026-08-03. They are stable, public, and
 * unauthenticated; if one starts 404ing the refresh job reports a failure for
 * that source and leaves the previous prefixes in place (see `refreshBotRanges`).
 *
 * ## Why this is a job and not a request-path fetch
 *
 * Verification runs on every bot hit. Fetching six documents per request would be
 * absurd, and caching them in module scope would still mean a cold start pays for
 * it — on Vercel, frequently. Instead the job writes prefixes to
 * `analytics.bot_ip_ranges` and the containment test runs in Postgres as part of
 * the INSERT, costing nothing extra.
 */

import type { BotRangeSource } from '$lib/server/db/schema/analytics/bot-hits';

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

/**
 * Shape-check a CIDR string before it can reach a `::cidr` cast.
 *
 * These documents are third-party input. A malformed prefix stored here would not
 * be a security problem — it is bound as a parameter, never spliced — but it
 * would make the verification query throw on a cast deep inside an INSERT, which
 * fails the hit that tripped over it rather than the feed that caused it.
 * Rejecting at ingest keeps the bad value out of the table entirely.
 */
export function isValidPrefix(prefix: string): boolean {
	const slash = prefix.indexOf('/');
	if (slash < 1) return false;
	const addr = prefix.slice(0, slash);
	const bits = Number(prefix.slice(slash + 1));
	if (!Number.isInteger(bits) || bits < 0) return false;

	if (addr.includes(':')) {
		if (bits > 128) return false;
		return /^[0-9a-fA-F:.]+$/.test(addr) && !addr.includes(':::');
	}

	if (bits > 32) return false;
	const octets = addr.split('.');
	if (octets.length !== 4) return false;
	return octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255);
}

/**
 * Shape-check a bare IP address before it can reach an `::inet` cast.
 *
 * Deliberately NOT `normalizeIpKey` from `$lib/server/abuse`: that function
 * returns a `/64` CIDR for IPv6 because it exists to build rate-limit buckets.
 * Containment needs the full host address — a `/64` would both fail the `::inet`
 * cast and, if it survived one, silently widen every IPv6 comparison to a whole
 * allocation.
 *
 * Permissive by design. Postgres is the real parser; this only has to keep
 * obvious junk from a header away from a cast that throws inside an INSERT.
 */
export function isPlausibleIpAddress(ip: string): boolean {
	if (ip.length === 0 || ip.length > 45) return false;

	if (ip.includes(':')) {
		if (!/^[0-9a-fA-F:.]+$/.test(ip)) return false;
		// `::` may appear once; three colons in a row is never valid.
		if (ip.includes(':::')) return false;
		return ip.split('::').length <= 2;
	}

	const octets = ip.split('.');
	if (octets.length !== 4) return false;
	return octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255);
}

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
