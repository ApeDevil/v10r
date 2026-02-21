/**
 * DOCUMENT VAULT — JSON vs JSONB types.
 * Mutability pattern: Soft delete (deleted_at).
 *
 * json  = stores exact text, preserves whitespace/key order, no indexing
 * jsonb = parsed binary, deduplicates keys, supports GIN indexes
 * Rule: Always use JSONB unless you need to preserve exact JSON text.
 */
import {
	text,
	json,
	jsonb,
	uuid,
	timestamp,
	serial,
	index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { showcaseSchema } from './type-specimen';

export const documentVault = showcaseSchema.table(
	'document_vault',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		title: text('title').notNull(),

		/** json: stores the literal JSON text — parsing happens on every access */
		rawJson: json('raw_json'),

		/** jsonb: parsed and stored in binary — supports GIN indexes and operators */
		metadata: jsonb('metadata').$type<{
			category: string;
			tags: string[];
			nested: { level: number; description: string };
		}>(),

		/** Another JSONB column for demonstrating varied shapes */
		settings: jsonb('settings').$type<Record<string, unknown>>(),

		/** NULL = active, non-NULL = soft deleted at this timestamp */
		deletedAt: timestamp('deleted_at', { withTimezone: true }),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		metadataGinIdx: index('vault_metadata_gin_idx').using('gin', table.metadata),
		activeTitleIdx: index('vault_active_title_idx')
			.on(table.title)
			.where(sql`deleted_at IS NULL`),
	}),
);
