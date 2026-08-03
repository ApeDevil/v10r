/**
 * Write chokepoint for the bot lane.
 *
 * One statement per hit, and the identity check happens INSIDE it. The
 * alternative — SELECT the prefixes, match in JS, then INSERT — costs a second
 * round trip on every crawler request and requires a hand-rolled CIDR matcher
 * that has to get IPv6 and v4-mapped-v6 containment right. Postgres already has
 * `<<=` for exactly this, so the verdict is computed where the data is.
 *
 * The source IP reaches this function, is compared, and is never stored. That is
 * the entire lifetime of the only value here that could identify anything.
 */

import { type SQL, sql } from 'drizzle-orm';
import type { BotIdentity } from '$lib/server/analytics/bot-classify';
import { isPlausibleIpAddress } from '$lib/server/analytics/bot-ranges';
import { db } from '$lib/server/db';

/** Matches the CHECK on `bot_hits.path`. Truncating here keeps the write from failing. */
const MAX_BOT_PATH_CHARS = 128;

export interface BotHitInput {
	identity: BotIdentity;
	/** Used only for the containment test. Never written. */
	ip: string | null;
	route: string | null;
	path: string | null;
	agentSurface: boolean;
	status: number;
}

export async function recordBotHit({ identity, ip, route, path, agentSurface, status }: BotHitInput): Promise<void> {
	// Mirrors `bot_hit_path_scope`. The CHECK is the guarantee; this is what keeps
	// an ordinary crawl of an ordinary page from tripping it.
	const storedPath = agentSurface || status >= 400 ? (path?.slice(0, MAX_BOT_PATH_CHARS) ?? null) : null;

	// Three short-circuits before any lookup, and the distinction between them is
	// the whole value of the column:
	//
	//  - no feed for this operator  → `unpublished`. Unknowable, NOT suspicious.
	//    Running the subquery here would mark every honest crawler whose operator
	//    publishes no list as `spoofed`.
	//  - no usable source address   → `unchecked`. We could have checked and did
	//    not, which is an operational gap rather than a verdict about the caller.
	//  - feed present but empty     → `unchecked`, decided in SQL below, because
	//    "the refresh job has never run" must never read as impersonation.
	let verification: SQL;
	if (identity.rangeSource === null) {
		verification = sql`'unpublished'::analytics.bot_verification`;
	} else if (ip === null || !isPlausibleIpAddress(ip)) {
		verification = sql`'unchecked'::analytics.bot_verification`;
	} else {
		const source = sql`${identity.rangeSource}::analytics.bot_range_source`;
		verification = sql`CASE
				WHEN NOT EXISTS (SELECT 1 FROM analytics.bot_ip_ranges WHERE source = ${source})
					THEN 'unchecked'::analytics.bot_verification
				WHEN EXISTS (
					SELECT 1 FROM analytics.bot_ip_ranges
					WHERE source = ${source}
					  AND ${ip}::inet <<= prefix::cidr
				) THEN 'verified'::analytics.bot_verification
				ELSE 'spoofed'::analytics.bot_verification
			END`;
	}

	await db.execute(sql`
		INSERT INTO analytics.bot_hits (family, category, verification, route, path, agent_surface, status)
		VALUES (
			${identity.family},
			${identity.category}::analytics.bot_category,
			${verification},
			${route},
			${storedPath},
			${agentSurface},
			${status}
		)
	`);
}
