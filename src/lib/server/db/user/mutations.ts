import { and, eq, ne } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { session as sessionTable, user } from '#lib/server/db/schema/auth/_better-auth.ts';

/** Update user display name. */
export async function updateDisplayName(userId: string, name: string) {
	await db.update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, userId));
}

/** Revoke a specific session (cannot revoke the current session). */
export async function revokeSession(sessionId: string, userId: string, currentSessionId: string) {
	await db
		.delete(sessionTable)
		.where(and(eq(sessionTable.id, sessionId), eq(sessionTable.userId, userId), ne(sessionTable.id, currentSessionId)));
}
