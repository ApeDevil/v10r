/**
 * COLLECTION — A named, user-owned scope for retrieval.
 *
 * Membership is not modelled: the junction table that once declared it was never
 * written to, so it was removed rather than left describing an association the
 * system does not maintain. Add it back with a writer, not before.
 */

import { sql } from 'drizzle-orm';
import { index, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { retrievalSchema } from './embedding-model';

export const collection = retrievalSchema.table(
	'collection',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('collection_user_idx').on(table.userId),
		index('collection_active_idx').on(table.userId, table.name).where(sql`deleted_at IS NULL`),
	],
);
