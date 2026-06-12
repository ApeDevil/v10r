/**
 * BETTER AUTH twoFactor plugin table — TOTP secret + backup codes.
 * Export name `twoFactor` must match the plugin's model id; field keys
 * are the adapter's lookup keys (exact camelCase).
 *
 * `secret` and `backupCodes` are encrypted by Better Auth with
 * BETTER_AUTH_SECRET before reaching this table — never plaintext.
 * `backupCodes` is a single encrypted comma-joined string, not an array.
 */
import { boolean, index, text } from 'drizzle-orm/pg-core';
import { authSchema, user } from './_better-auth';

export const twoFactor = authSchema.table(
	'two_factor',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		secret: text('secret').notNull(),
		backupCodes: text('backup_codes').notNull(),
		verified: boolean('verified').notNull().default(false),
	},
	(table) => [index('auth_two_factor_user_idx').on(table.userId)],
);
