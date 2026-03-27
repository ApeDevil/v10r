/**
 * BETTER AUTH SCHEMA — Auto-generated table structure.
 * Do NOT edit column definitions — Better Auth expects these exact shapes.
 * To extend user data, create a separate table with a foreign key.
 */
import { boolean, index, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

export const user = authSchema.table('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),

	// ── Admin plugin columns ──────────────────────────────────────────
	role: text('role').notNull().default('user'),
	banned: boolean('banned').default(false),
	bannedAt: timestamp('banned_at'),
	banReason: text('ban_reason'),
});

export const session = authSchema.table(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),

		// ── Admin plugin columns ──────────────────────────────────────
		impersonatedBy: text('impersonated_by'),
	},
	(table) => [index('session_user_id_idx').on(table.userId), index('session_expires_at_idx').on(table.expiresAt)],
);

export const account = authSchema.table(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
	},
	(table) => [index('account_user_id_idx').on(table.userId)],
);

export const verification = authSchema.table('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at'),
});
