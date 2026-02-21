/**
 * COLLECTION SHELF — PostgreSQL array types.
 *
 * Arrays are powerful but have trade-offs:
 *   Pros: No join needed, atomic updates, natural for ordered lists
 *   Cons: No foreign keys on elements, harder to query individually
 *
 * Rule of thumb: tags/labels/small lists → array. IDs/references → junction table.
 */
import { text, integer, jsonb, serial, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { showcaseSchema } from './type-specimen';

export const collectionShelf = showcaseSchema.table(
	'collection_shelf',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),

		/** integer[]: array of integers */
		scores: integer('scores').array(),

		/** text[]: array of strings — most common array use case */
		tags: text('tags').array().default(sql`ARRAY[]::text[]`),

		/** jsonb[]: array of JSONB objects */
		steps: jsonb('steps').array(),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		tagsGinIdx: index('shelf_tags_gin_idx').using('gin', table.tags),
		scoresGinIdx: index('shelf_scores_gin_idx').using('gin', table.scores),
	}),
);
