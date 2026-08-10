/**
 * ANALYTICS EVENTS — Raw event log for page views, actions, errors, and timing.
 * Privacy-first: visitorId is always hashed, never raw IP.
 */
import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const analyticsSchema = pgSchema('analytics');

export const eventTypeEnum = analyticsSchema.enum('event_type', ['pageview', 'action', 'error', 'timing']);

/**
 * Two tiers, not three. `necessary` collects aggregate pageviews, connection-
 * derived geo and coarse timing with no device access; `analytics` adds the
 * session cookie, referrer, UA-derived device/browser, and behavioural events.
 * A former `full` tier was removed because nothing gated on it.
 */
export const consentTierEnum = analyticsSchema.enum('consent_tier', ['necessary', 'analytics']);

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
		/**
		 * Templated route (`/blog/[slug]`), the cardinality-bounded grouping key.
		 * `path` stays raw for detail views; every aggregate groups by this instead,
		 * so publishing more content cannot degrade the dashboards.
		 */
		route: text('route'),
		referrer: text('referrer'),
		/** Allowlisted event properties only — see analytics/event-schema.ts. */
		metadata: jsonb('metadata').$type<Record<string, string | number | boolean> | null>(),
		consentTier: consentTierEnum('consent_tier').notNull().default('necessary'),
		/** Admin user id when this event came from a paired debug device. Immutable per row. */
		debugOwnerId: text('debug_owner_id').references(() => user.id, { onDelete: 'set null' }),
		timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('events_event_id_idx').on(table.eventId),
		index('events_session_timestamp_idx').on(table.sessionId, table.timestamp),
		index('events_path_timestamp_idx').on(table.path, table.timestamp),
		// Aggregates group by route, not path — this is the index they ride.
		index('events_route_timestamp_idx').on(table.route, table.timestamp),
		index('events_type_timestamp_idx').on(table.eventType, table.timestamp),
		index('events_timestamp_idx').on(table.timestamp),
		index('events_debug_owner_idx').on(table.debugOwnerId, table.id).where(sql`${table.debugOwnerId} IS NOT NULL`),
	],
);
