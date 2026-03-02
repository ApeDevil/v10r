/**
 * ANALYTICS EVENTS — Raw event log for page views, actions, errors, and timing.
 * Privacy-first: visitorId is always hashed, never raw IP.
 */
import { pgSchema, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const analyticsSchema = pgSchema('analytics');

export const eventTypeEnum = analyticsSchema.enum('event_type', [
	'pageview',
	'action',
	'error',
	'timing',
]);

export const consentTierEnum = analyticsSchema.enum('consent_tier', [
	'necessary',
	'analytics',
	'full',
]);

export const events = analyticsSchema.table(
	'events',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		sessionId: text('session_id').notNull(),
		visitorId: text('visitor_id').notNull(),
		eventType: eventTypeEnum('event_type').notNull(),
		path: text('path').notNull(),
		referrer: text('referrer'),
		metadata: jsonb('metadata'),
		consentTier: consentTierEnum('consent_tier').notNull().default('necessary'),
		timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('events_session_timestamp_idx').on(table.sessionId, table.timestamp),
		index('events_path_timestamp_idx').on(table.path, table.timestamp),
		index('events_timestamp_idx').on(table.timestamp),
	],
);
