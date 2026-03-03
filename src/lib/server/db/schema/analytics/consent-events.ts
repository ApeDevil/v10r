/**
 * CONSENT EVENTS — Append-only audit log for consent changes (GDPR Art 7(1)).
 * Records every grant, change, and withdrawal of consent.
 */
import { text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { analyticsSchema, consentTierEnum } from './events';

export const consentActionEnum = analyticsSchema.enum('consent_action', [
	'grant',
	'change',
	'withdraw',
]);

export const consentEvents = analyticsSchema.table(
	'consent_events',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		visitorId: text('visitor_id').notNull(),
		action: consentActionEnum('action').notNull(),
		tierBefore: consentTierEnum('tier_before'),
		tierAfter: consentTierEnum('tier_after').notNull(),
		uaHash: text('ua_hash'),
		timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('consent_events_visitor_idx').on(table.visitorId),
		index('consent_events_timestamp_idx').on(table.timestamp),
	],
);
