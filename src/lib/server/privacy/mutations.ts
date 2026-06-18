/**
 * GDPR Art 17 erasure — one canonical definition of "delete everything".
 *
 * deleteUser() removes the auth.user row; every user-keyed table references
 * it with onDelete: 'cascade' (sessions, accounts, preferences, conversations,
 * desk, notification links, comments, palettes, RAG documents+chunks), so the
 * cascade IS the relational erasure. Analytics rows are untouched by design:
 * they are keyed by hashed visitorId, never by user id (debugOwnerId/
 * pairedAdminUserId use 'set null'). Idempotent — deleting an already-deleted
 * user is a no-op.
 *
 * Postgres CASCADE does not reach Neo4j, so the RAG graph mirror (the user's
 * :Chunk/:Entity nodes) is swept separately. The graph sweep is best-effort:
 * an Aura outage must not block the authoritative relational erasure.
 */

import { deleteUser } from '$lib/server/db/user';
import { deleteUserGraph } from '$lib/server/graph/rag/mutations';

export async function deleteUserData(userId: string): Promise<void> {
	await deleteUser(userId);
	try {
		await deleteUserGraph(userId);
	} catch (err) {
		console.error('[privacy] Neo4j graph sweep failed during user erasure:', err instanceof Error ? err.message : err);
	}
}
