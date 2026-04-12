import { and, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { session as sessionTable, user } from '$lib/server/db/schema/auth/_better-auth';

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

/** Delete a user record — cascades to sessions and accounts via FK. */
export async function deleteUser(userId: string) {
	await db.delete(user).where(eq(user.id, userId));
}
