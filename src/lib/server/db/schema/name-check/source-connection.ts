/**
 * NAME SOURCE CONNECTION — the administrator-managed credentials for each external
 * vendor the name check can query. One row per vendor; an absent row means "never
 * configured". The AI providers' `ai.provider_connection` is the sibling shape.
 *
 * The secret — EUIPO's client secret, Tavily's or Brave's API key — is stored only as an
 * AES-256-GCM envelope (`security/aes-gcm.ts`) sealed with the deployment's
 * `ENCRYPTION_KEY`, which never lives in this database. EUIPO alone needs a client id and
 * runs a Sandbox environment on hosts other than the production defaults, so those columns
 * are nullable and a CHECK keeps them empty on every other vendor: the table says which
 * fields belong to whom instead of a form having to know.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';

export const nameCheckSchema = pgSchema('name_check');

export const nameSourceVendorEnum = nameCheckSchema.enum('name_source_vendor', ['euipo', 'tavily', 'brave']);

export const sourceConnection = nameCheckSchema.table(
	'source_connection',
	{
		vendor: nameSourceVendorEnum('vendor').primaryKey(),
		enabled: boolean('enabled').notNull().default(false),
		/** EUIPO's OAuth client id — sent in the clear as `X-IBM-Client-Id`, so not a secret. */
		clientId: text('client_id'),
		secretCiphertext: text('secret_ciphertext'),
		/** EUIPO hosts; null means the documented defaults in `name-check/sources/euipo.ts`. */
		apiBase: text('api_base'),
		tokenUrl: text('token_url'),
		/** Optimistic-concurrency counter: every write bumps it and must name the value it saw. */
		version: integer('version').notNull().default(1),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
	},
	(table) => [
		check(
			'source_connection_euipo_fields',
			sql`${table.vendor} = 'euipo' OR (${table.clientId} IS NULL AND ${table.apiBase} IS NULL AND ${table.tokenUrl} IS NULL)`,
		),
		// A client secret travels with every token request; the host it goes to is never plain http.
		check(
			'source_connection_https',
			sql`(${table.apiBase} IS NULL OR ${table.apiBase} LIKE 'https://%') AND (${table.tokenUrl} IS NULL OR ${table.tokenUrl} LIKE 'https://%')`,
		),
		check(
			'source_connection_field_len',
			sql`char_length(coalesce(${table.clientId}, '')) <= 200 AND char_length(coalesce(${table.apiBase}, '')) <= 300 AND char_length(coalesce(${table.tokenUrl}, '')) <= 300`,
		),
	],
);

export type NameSourceConnectionRow = typeof sourceConnection.$inferSelect;
