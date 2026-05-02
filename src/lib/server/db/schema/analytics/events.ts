/**
 * ANALYTICS EVENTS — Raw event log for page views, actions, errors, and timing.
 * Privacy-first: visitorId is always hashed, never raw IP.
 */
import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const analyticsSchema = pgSchema('analytics');

export const eventTypeEnum = analyticsSchema.enum('event_type', ['pageview', 'action', 'error', 'timing']);

export const consentTierEnum = analyticsSchema.enum('consent_tier', ['necessary', 'analytics', 'full']);

export const events = analyticsSchema.table(
	'events',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		/** Client- or server-generated UUID for idempotent ingestion via the SPA beacon. */
		eventId: text('event_id'),
		sessionId: text('session_id').notNull(),
		visitorId: text('visitor_id').notNull(),
		eventType: eventTypeEnum('event_type').notNull(),
		path: text('path').notNull(),
		referrer: text('referrer'),
		metadata: jsonb('metadata'),
		consentTier: consentTierEnum('consent_tier').notNull().default('necessary'),
		/** Admin user id when this event came from a paired debug device. Immutable per row. */
		debugOwnerId: text('debug_owner_id').references(() => user.id, { onDelete: 'set null' }),
		timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('events_event_id_idx').on(table.eventId),
		index('events_session_timestamp_idx').on(table.sessionId, table.timestamp),
		index('events_path_timestamp_idx').on(table.path, table.timestamp),
		index('events_timestamp_idx').on(table.timestamp),
		index('events_debug_owner_idx').on(table.debugOwnerId, table.id).where(sql`${table.debugOwnerId} IS NOT NULL`),
	],
);
