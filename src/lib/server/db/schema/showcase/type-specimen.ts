/**
 * TYPE SPECIMEN — Numeric, Text, Boolean, UUID types.
 * Mutability pattern: Standard CRUD with updated_at.
 */

import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	char,
	check,
	doublePrecision,
	index,
	integer,
	numeric,
	pgSchema,
	real,
	serial,
	smallint,
	text,
	timestamp,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const showcaseSchema = pgSchema('showcase');

export const typeSpecimen = showcaseSchema.table(
	'type_specimen',
	{
		/** serial: auto-incrementing 32-bit integer */
		id: serial('id').primaryKey(),

		/** uuid: 128-bit universally unique identifier (v4 via gen_random_uuid) */
		externalId: uuid('external_id').notNull().defaultRandom().unique(),

		/** text: unlimited length string — the workhorse string type */
		label: text('label').notNull(),

		/** varchar(n): variable-length with limit */
		code: varchar('code', { length: 10 }).notNull().unique(),

		/** char(n): fixed-length, space-padded */
		countryCode: char('country_code', { length: 2 }),

		/** smallint: 2 bytes, -32768 to 32767 */
		rating: smallint('rating'),

		/** integer: 4 bytes, the default numeric type */
		quantity: integer('quantity').notNull().default(0),

		/** bigint: 8 bytes, for counters that might exceed 2 billion */
		viewCount: bigint('view_count', { mode: 'number' }).notNull().default(0),

		/** numeric(precision, scale): exact decimal — use for money */
		price: numeric('price', { precision: 10, scale: 2 }),

		/** real: 4-byte floating point (6 decimal digits precision) */
		temperature: real('temperature'),

		/** doublePrecision: 8-byte floating point (15 decimal digits) */
		latitude: doublePrecision('latitude'),
		longitude: doublePrecision('longitude'),

		/** boolean: true/false/null */
		isActive: boolean('is_active').notNull().default(true),

		/** timestamptz: the ONLY timestamp type you should use for wall-clock times */
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		labelIdx: index('specimen_label_idx').on(table.label),
		ratingRange: check('rating_range', sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
		quantityPositive: check('quantity_positive', sql`${table.quantity} >= 0`),
	}),
);

/**
 * TYPE SPECIMEN HISTORY — Versioned records pattern.
 * Every update to type_specimen inserts a snapshot here.
 */
export const typeSpecimenHistory = showcaseSchema.table(
	'type_specimen_history',
	{
		historyId: serial('history_id').primaryKey(),
		specimenId: integer('specimen_id')
			.notNull()
			.references(() => typeSpecimen.id, { onDelete: 'cascade' }),
		version: integer('version').notNull(),
		label: text('label').notNull(),
		code: varchar('code', { length: 10 }).notNull(),
		rating: smallint('rating'),
		quantity: integer('quantity').notNull(),
		price: numeric('price', { precision: 10, scale: 2 }),
		isActive: boolean('is_active').notNull(),
		changedBy: text('changed_by').notNull().default('system'),
		changeType: text('change_type').notNull(),
		changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		specimenIdx: index('history_specimen_id_idx').on(table.specimenId),
		specimenVersionIdx: index('history_specimen_version_idx').on(table.specimenId, table.version),
	}),
);
