import { getAuthenticatorName } from '@better-auth/passkey';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { account, session as sessionTable, user } from '$lib/server/db/schema/auth/_better-auth';
import { passkey } from '$lib/server/db/schema/auth/passkey';

/** Fetch all sessions for a user. */
export async function getUserSessions(userId: string) {
	return db
		.select({
			id: sessionTable.id,
			createdAt: sessionTable.createdAt,
			expiresAt: sessionTable.expiresAt,
			ipAddress: sessionTable.ipAddress,
			userAgent: sessionTable.userAgent,
		})
		.from(sessionTable)
		.where(eq(sessionTable.userId, userId));
}

/** Fetch all linked OAuth accounts for a user. */
export async function getUserAccounts(userId: string) {
	return db
		.select({
			providerId: account.providerId,
			createdAt: account.createdAt,
		})
		.from(account)
		.where(eq(account.userId, userId));
}

/**
 * OAuth account summary for transparency/export surfaces.
 * Tokens are projected to PRESENCE booleans at query level — the raw
 * accessToken/refreshToken/idToken values must never leave the DB layer.
 */
export async function getUserOAuthSummary(userId: string) {
	return db
		.select({
			provider: account.providerId,
			scope: account.scope,
			linkedAt: account.createdAt,
			hasAccessToken: sql<boolean>`${account.accessToken} IS NOT NULL`,
			hasRefreshToken: sql<boolean>`${account.refreshToken} IS NOT NULL`,
			accessTokenExpiresAt: account.accessTokenExpiresAt,
		})
		.from(account)
		.where(eq(account.userId, userId));
}

/**
 * Passkey list for management/transparency surfaces. Credential internals
 * (publicKey, credentialID, counter, raw aaguid) are projected out at query
 * level — only display metadata leaves the DB layer. The authenticator label
 * is resolved from the aaguid here so the raw value never reaches a DTO.
 */
export async function listPasskeyDtos(userId: string) {
	const rows = await db
		.select({
			id: passkey.id,
			name: passkey.name,
			deviceType: passkey.deviceType,
			backedUp: passkey.backedUp,
			createdAt: passkey.createdAt,
			lastUsedAt: passkey.lastUsedAt,
			aaguid: passkey.aaguid,
		})
		.from(passkey)
		.where(eq(passkey.userId, userId));

	return rows.map(({ aaguid, ...row }) => ({
		...row,
		authenticatorLabel: getAuthenticatorName(aaguid) ?? null,
	}));
}

/** Number of passkeys a user has registered (enrollment nudge). */
export async function countPasskeys(userId: string): Promise<number> {
	const rows = await db.select({ count: sql<number>`count(*)::int` }).from(passkey).where(eq(passkey.userId, userId));
	return rows[0]?.count ?? 0;
}

/** Stamp a passkey's last successful sign-in (app-owned column). */
export async function touchPasskeyLastUsed(credentialID: string): Promise<void> {
	await db.update(passkey).set({ lastUsedAt: new Date() }).where(eq(passkey.credentialID, credentialID));
}

/** Fetch core user profile fields for data export. */
export async function getUserProfile(userId: string) {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			image: user.image,
			createdAt: user.createdAt,
		})
		.from(user)
		.where(eq(user.id, userId));
	return rows[0] ?? null;
}
