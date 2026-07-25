/**
 * ANALYTICS USER EVENTS — the authenticated lane.
 *
 * The second of two deliberately separated lanes:
 *
 *   analytics.events       visitor_id = SHA256(ip:ua)   anonymous, Art 6(1)(f) + LIA
 *   analytics.user_events  user_id  → auth.user         identified, Art 6(1)(b)/(f)
 *
 * ## The wall
 *
 * This table has NO `visitor_id`, and `analytics.events` has no `user_id`. That
 * is a structural guarantee, not a convention, and it must stay that way.
 *
 * The anonymous lane's legal basis is assessed on the premise that its subjects
 * are anonymous visitors. If a hashed visitor could be walked to a user id, that
 * premise fails and the anonymous lane inherits the identified lane's
 * obligations — including being reachable by an Art 15 access request and an
 * Art 17 erasure. Adding a join key between these tables is therefore not a
 * refactor; it is a change of legal position. Do not add one.
 *
 * ## Why this lane can be richer
 *
 * For a logged-in user the ePrivacy gate does not engage: the auth cookie is
 * already strictly necessary under TDDDG §25(2) Nr.2, so no additional consent
 * is required to read it. Processing rests on Art 6(1)(b) (operating the account
 * the user asked for) and Art 6(1)(f) (improving it). No consent banner tier
 * applies here.
 *
 * The hard stop is Art 22: nothing derived from this table may drive a solely
 * automated decision with legal or similarly significant effect on the user.
 * Aggregate product analytics — cohorts, retention, funnels — is fine.
 *
 * ## Erasure
 *
 * `onDelete: 'cascade'` makes deletion automatic: removing the `auth.user` row
 * removes these. That is why `deleteUserData` needs no extra call — but it is
 * also why the FK must never be weakened to `set null`.
 */
import { index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { analyticsSchema, eventTypeEnum } from './events';

/** Which authenticated area produced the event. Bounded on purpose. */
export const userSurfaceEnum = analyticsSchema.enum('user_surface', ['account']);

export const userEvents = analyticsSchema.table(
	'user_events',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		/** Client- or server-generated UUID for idempotent ingestion. */
		eventId: text('event_id'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		surface: userSurfaceEnum('surface').notNull(),
		eventType: eventTypeEnum('event_type').notNull(),
		/** Templated route (`/account/[tab]`) — the bounded aggregation key. */
		route: text('route').notNull(),
		/** Raw pathname, for detail views. */
		path: text('path').notNull(),
		/** Allowlisted properties only — see analytics/event-schema.ts. */
		metadata: jsonb('metadata').$type<Record<string, string | number | boolean> | null>(),
		timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('user_events_event_id_idx').on(table.eventId),
		// Primary query: one user's activity over time (Art 15 access, retention).
		index('user_events_user_ts_idx').on(table.userId, table.timestamp),
		// Aggregates: which authenticated screens get used, and how often.
		index('user_events_route_ts_idx').on(table.route, table.timestamp),
		index('user_events_ts_idx').on(table.timestamp),
	],
);
