/**
 * ANALYTICS SESSIONS — Visitor session records.
 *
 * `device` and `browser` are UA-derived (terminal configuration) and are only
 * populated at the `analytics` tier. `country` is derived from the connection at
 * the edge, never from the device, so it is populated at every tier. See
 * `$lib/server/analytics/enrich.ts` for the legal reasoning behind the split.
 */
import { sql } from 'drizzle-orm';
import { char, index, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { analyticsSchema, consentTierEnum } from './events';

/**
 * Connection-origin classification, computed ONCE at session write time by
 * containment against `datacenter_ip_ranges` (see dc-ranges.ts). The IP itself
 * is compared and never stored — this column is the only thing that survives.
 *
 * NULL = never classified (range table empty at write time, unusable address,
 * or a row predating the feature) — the analogue of the bot lane's `unchecked`.
 * `unknown` = checked and matched nothing: residential, mobile, or a cloud
 * whose operator publishes no ranges (Alibaba and Tencent publish none).
 *
 * This signal RANKS the unconfirmed bucket in reporting. It must never appear
 * in an exclusion predicate: its false positives are real people (VPNs, and
 * `icloud_relay` — Apple warns many Private Relay users share one egress IP).
 */
export const ipClassEnum = analyticsSchema.enum('ip_class', ['datacenter', 'icloud_relay', 'unknown']);

export const sessions = analyticsSchema.table(
	'sessions',
	{
		id: text('id').primaryKey(),
		visitorId: text('visitor_id').notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		endedAt: timestamp('ended_at', { withTimezone: true }),
		pageCount: integer('page_count').notNull().default(0),
		entryPath: text('entry_path').notNull(),
		exitPath: text('exit_path'),
		device: text('device'),
		browser: text('browser'),
		country: char('country', { length: 2 }),
		consentTier: consentTierEnum('consent_tier').notNull().default('necessary'),
		/** Admin user id this session is paired to for debug streaming. NULL = anonymous. */
		pairedAdminUserId: text('paired_admin_user_id').references(() => user.id, { onDelete: 'set null' }),
		/** When pairing was claimed. Used for the 2h hard cap. */
		pairedAt: timestamp('paired_at', { withTimezone: true }),
		/**
		 * When client-side JavaScript first corroborated this session — the beacon
		 * confirm ping, a journey batch, or a telemetry batch, whichever lands
		 * first. NULL = no client-side evidence: the session exists only as
		 * server-observed requests, which is what UA-spoofing crawlers produce.
		 *
		 * Set once, never cleared. This is the counting line for "confirmed
		 * visitors"; deliberately NOT named "human" — an agentic browser is a real
		 * Chromium and will confirm.
		 */
		humanConfirmedAt: timestamp('human_confirmed_at', { withTimezone: true }),
		/**
		 * Permanent copy of the debug-owner attribution, unlike
		 * `paired_admin_user_id`, which the cleanup reaper NULLs two hours after
		 * pairing (that cap is a privacy bound on live streaming, not on
		 * attribution). Aggregates exclude on this column; without it, a session's
		 * debug provenance would evaporate mid-retention while its event rows
		 * (`events.debug_owner_id`, immutable) still carried it.
		 */
		debugOwnerId: text('debug_owner_id').references(() => user.id, { onDelete: 'set null' }),
		ipClass: ipClassEnum('ip_class'),
	},
	(table) => [
		index('sessions_visitor_idx').on(table.visitorId),
		index('sessions_started_desc_idx').on(table.startedAt.desc()),
		index('sessions_paired_admin_idx')
			.on(table.pairedAdminUserId, table.endedAt.desc())
			.where(sql`${table.pairedAdminUserId} IS NOT NULL`),
		index('sessions_confirmed_idx').on(table.startedAt.desc()).where(sql`${table.humanConfirmedAt} IS NOT NULL`),
		index('sessions_debug_owner_idx').on(table.debugOwnerId).where(sql`${table.debugOwnerId} IS NOT NULL`),
	],
);
