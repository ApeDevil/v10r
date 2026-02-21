/**
 * RANGE BOOKING — PostgreSQL range types (int4range, tstzrange, daterange).
 *
 * Range types are one of PostgreSQL's most underappreciated features.
 * Instead of separate (start, end) columns with complex overlap queries,
 * a single range value handles containment, overlap, and adjacency natively.
 *
 * Operators: @> (contains), && (overlaps), -|- (adjacent), + (union), * (intersection)
 * Bounds: [ inclusive, ( exclusive — convention: use [lower, upper)
 */
import {
	text,
	serial,
	integer,
	timestamp,
	index,
	check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { showcaseSchema } from './type-specimen';
import { int4range, tstzrange, daterange } from './_custom-types';

export const rangeBooking = showcaseSchema.table(
	'range_booking',
	{
		id: serial('id').primaryKey(),
		resourceName: text('resource_name').notNull(),

		/** int4range: range of integers (floors, versions, priority bands) */
		floorRange: int4range('floor_range'),

		/** tstzrange: range of timestamptz (booking time slots) */
		bookingPeriod: tstzrange('booking_period'),

		/** daterange: range of dates (reservations, subscriptions) */
		reservationDates: daterange('reservation_dates'),

		priority: integer('priority').notNull().default(5),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		resourceIdx: index('booking_resource_name_idx').on(table.resourceName),
		bookingPeriodGistIdx: index('booking_period_gist_idx')
			.using('gist', table.bookingPeriod),
		reservationGistIdx: index('booking_reservation_gist_idx')
			.using('gist', table.reservationDates),
		priorityValid: check(
			'priority_valid',
			sql`${table.priority} >= 1 AND ${table.priority} <= 10`,
		),
	}),
);
