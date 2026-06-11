/**
 * GDPR Art 17 erasure — one canonical definition of "delete everything".
 *
 * deleteUser() removes the auth.user row; every user-keyed table references
 * it with onDelete: 'cascade' (sessions, accounts, preferences, conversations,
 * desk, notification links, comments, palettes), so the cascade IS the
 * full erasure. Analytics rows are untouched by design: they are keyed by
 * hashed visitorId, never by user id (debugOwnerId/pairedAdminUserId use
 * 'set null'). Idempotent — deleting an already-deleted user is a no-op.
 */
import { deleteUser } from '$lib/server/db/user';

export async function deleteUserData(userId: string): Promise<void> {
	await deleteUser(userId);
}
