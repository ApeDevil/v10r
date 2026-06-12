/**
 * BETTER AUTH passkey plugin table — WebAuthn credentials.
 * Field keys are the adapter's model lookup keys (exact camelCase,
 * e.g. `credentialID`); the export name `passkey` must match the
 * plugin's model id. SQL names are free to follow snake_case.
 *
 * publicKey/credentialID are public WebAuthn material — the private
 * key never leaves the authenticator. `lastUsedAt` is app-owned
 * (updated via the auth after-hook on /passkey/verify-authentication),
 * not part of the plugin schema.
 */
import { boolean, index, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { authSchema, user } from './_better-auth';

export const passkey = authSchema.table(
	'passkey',
	{
		id: text('id').primaryKey(),
		name: text('name'),
		publicKey: text('public_key').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		credentialID: text('credential_id').notNull(),
		counter: integer('counter').notNull(),
		deviceType: text('device_type').notNull(),
		backedUp: boolean('backed_up').notNull(),
		transports: text('transports'),
		aaguid: text('aaguid'),
		createdAt: timestamp('created_at').defaultNow(),
		lastUsedAt: timestamp('last_used_at'),
	},
	(table) => [
		index('auth_passkey_user_idx').on(table.userId),
		uniqueIndex('auth_passkey_credential_id_uniq').on(table.credentialID),
	],
);
