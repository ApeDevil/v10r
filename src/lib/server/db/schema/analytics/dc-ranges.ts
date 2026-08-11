/**
 * DATACENTER IP RANGES — published cloud/relay prefixes for connection-origin
 * classification (`sessions.ip_class`).
 *
 * Same design as `bot_ip_ranges` (bot-hits.ts), different scale: the bot table
 * holds ~750 crawler prefixes, this one holds tens of thousands (AWS alone is
 * ~8k; the iCloud relay CSV is larger still). Rows are refreshed by the
 * `bot-ranges-refresh` job with the same per-source fetch-validate-swap
 * semantics — a failed or empty fetch keeps the previous rows, because an empty
 * table silently downgrades every new session to unclassified (NULL).
 *
 * `icloud_relay` is in the SAME table but is the opposite of a datacenter
 * signal: Apple publishes these egress ranges precisely so operators do NOT
 * mistake relay users for hosting traffic ("many Private Relay users may be
 * assigned to a single relay IP address"). The containment CASE in
 * `upsertSession` checks relay FIRST — relay egress rides commercial cloud
 * address space, so datacenter-first would misclassify every relay user.
 */
import { sql } from 'drizzle-orm';
import { index, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { analyticsSchema } from './events';

/** Operators whose published prefix feeds we ingest. Alibaba/Tencent publish none. */
export const dcRangeSourceEnum = analyticsSchema.enum('dc_range_source', [
	'aws',
	'gcp',
	'oracle',
	'digitalocean',
	'cloudflare',
	'icloud_relay',
]);

export type DcRangeSource = (typeof dcRangeSourceEnum.enumValues)[number];

export const datacenterIpRanges = analyticsSchema.table(
	'datacenter_ip_ranges',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		source: dcRangeSourceEnum('source').notNull(),
		/** CIDR prefix as text; validated by isValidPrefix before insert, cast at query time. */
		prefix: text('prefix').notNull(),
		fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		unique('dc_ip_ranges_source_prefix_uniq').on(table.source, table.prefix),
		index('dc_ip_ranges_source_idx').on(table.source),
		// Expression index matching the write-time containment test
		// (`$ip::inet <<= prefix::cidr`). Without it every session upsert seq-scans
		// tens of thousands of rows; off-TTFB but pure waste.
		index('dc_ip_ranges_prefix_gist_idx').using('gist', sql`(${table.prefix}::cidr) inet_ops`),
	],
);
