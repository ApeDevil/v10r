/**
 * AI PROVIDER CONNECTION — the administrator-managed credentials and model choice for
 * each AI vendor. One row per provider; an absent row means "never configured".
 *
 * The API key is stored only as an AES-256-GCM envelope (`security/aes-gcm.ts`) sealed
 * with the deployment's `ENCRYPTION_KEY`, which never lives in this database. The
 * project default is a flag on the row rather than a separate table so the two rules
 * that matter — at most one default, and never a default that cannot serve — are
 * expressed as constraints instead of application code.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { aiSchema } from './conversation';

export const aiProviderEnum = aiSchema.enum('ai_provider', ['groq', 'openai', 'google']);

export const providerConnection = aiSchema.table(
	'provider_connection',
	{
		provider: aiProviderEnum('provider').primaryKey(),
		enabled: boolean('enabled').notNull().default(false),
		modelId: text('model_id').notNull(),
		apiKeyCiphertext: text('api_key_ciphertext'),
		isDefault: boolean('is_default').notNull().default(false),
		/** Optimistic-concurrency counter: every write bumps it and must name the value it saw. */
		version: integer('version').notNull().default(1),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
	},
	(table) => [
		uniqueIndex('provider_connection_default_uniq').on(table.isDefault).where(sql`${table.isDefault} = true`),
		check(
			'provider_connection_default_usable',
			sql`NOT ${table.isDefault} OR (${table.enabled} AND ${table.apiKeyCiphertext} IS NOT NULL)`,
		),
		check('provider_connection_model_id_len', sql`char_length(${table.modelId}) BETWEEN 1 AND 120`),
	],
);

export type ProviderConnectionRow = typeof providerConnection.$inferSelect;
