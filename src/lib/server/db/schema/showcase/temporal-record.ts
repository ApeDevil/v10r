/**
 * TEMPORAL RECORD — Date, Time, Timestamp, Interval types.
 * Mutability pattern: Bi-temporal (valid_from/valid_to + recorded_at).
 */

import { sql } from 'drizzle-orm';
import { check, date, index, interval, serial, text, time, timestamp } from 'drizzle-orm/pg-core';
import { showcaseSchema } from './type-specimen';

export const temporalRecord = showcaseSchema.table(
	'temporal_record',
	{
		id: serial('id').primaryKey(),
		description: text('description').notNull(),

		/** date: calendar date without time (YYYY-MM-DD) */
		eventDate: date('event_date'),

		/** time: time of day without date or timezone */
		eventTime: time('event_time'),

		/** timestamp WITHOUT timezone: fixed point on a wall clock (rarely what you want) */
		localTimestamp: timestamp('local_timestamp', { withTimezone: false }),

		/** timestamptz: stores as UTC, converts to session timezone on read */
		utcTimestamp: timestamp('utc_timestamp', { withTimezone: true }),

		/** interval: a duration (e.g., '2 hours 30 minutes', '1 year 3 months') */
		duration: interval('duration'),

		/** When this fact becomes true in the real world */
		validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),

		/** When this fact stops being true. NULL means "still current" */
		validTo: timestamp('valid_to', { withTimezone: true }),

		/** System time: when we recorded this fact */
		recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		validRangeIdx: index('temporal_valid_range_idx').on(table.validFrom, table.validTo),
		validRangeCheck: check('valid_range_check', sql`${table.validTo} IS NULL OR ${table.validFrom} < ${table.validTo}`),
	}),
);
