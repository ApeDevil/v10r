/**
 * The verdict behind `bot_hits.verification`, computed at buffer time.
 *
 * Four outcomes, and the distinction between them is the whole value of the column:
 *
 *  - no feed for this operator  → `unpublished`. Unknowable, NOT suspicious. Running a
 *    check here would mark every honest crawler whose operator publishes no list as
 *    `spoofed`.
 *  - no usable source address   → `unchecked`. We could have checked and did not — an
 *    operational gap, not a verdict about the caller.
 *  - feed missing or empty      → `unchecked`, because "the refresh job has never run"
 *    must never read as impersonation.
 *  - a match, or not            → `verified` / `spoofed`.
 *
 * The prefix source is injected so the verdict logic is testable without Redis; the
 * request path passes `publishedBotRanges` (see `bot-ranges.ts`).
 */

import type { BotRangeSource, BotVerification } from '$lib/server/db/schema/analytics/bot-hits';
import type { BotIdentity } from './bot-classify';
import { normalizeIpForVerification } from './bot-ranges';
import { ipInPrefix } from './ip-prefix';

/** Published prefixes for one operator, or null when none are available. */
export type PublishedPrefixes = (source: BotRangeSource) => Promise<readonly string[] | null>;

export async function verifyBotIdentity(
	identity: BotIdentity,
	ip: string | null,
	prefixesFor: PublishedPrefixes,
): Promise<BotVerification> {
	if (identity.rangeSource === null) return 'unpublished';

	// Unwrapped, not merely validated: an IPv4-mapped IPv6 address is a DIFFERENT
	// family to the comparison, so `::ffff:1.2.3.4` would match no published IPv4
	// prefix and a genuine crawler would be reported as `spoofed`.
	const comparableIp = normalizeIpForVerification(ip);
	if (comparableIp === null) return 'unchecked';

	const prefixes = await prefixesFor(identity.rangeSource);
	if (!prefixes || prefixes.length === 0) return 'unchecked';

	return prefixes.some((prefix) => ipInPrefix(comparableIp, prefix)) ? 'verified' : 'spoofed';
}
