import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { account, session as sessionTable, user } from '$lib/server/db/schema/auth/_better-auth';

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
