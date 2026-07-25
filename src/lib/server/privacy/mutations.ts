/**
 * GDPR Art 17 erasure — one canonical definition of "delete everything".
 *
 * deleteUser() removes the auth.user row; every user-keyed table references
 * it with onDelete: 'cascade' (sessions, accounts, preferences, conversations,
 * desk, notification links, comments, palettes, RAG documents+chunks), so the
 * cascade IS the relational erasure. Idempotent — deleting an already-deleted
 * user is a no-op.
 *
 * Analytics splits across the two lanes, and they erase differently:
 * - `analytics.user_events` IS erased, automatically. Its `user_id` FK cascades,
 *   which is exactly why that FK must stay 'cascade' and never become 'set null'.
 * - `analytics.events` / `analytics.sessions` are NOT erased and must not be.
 *   They are keyed by a hashed visitorId with no user reference, so there is
 *   nothing to match a user against — and manufacturing a match would require
 *   the re-identification path this architecture deliberately does not have.
 *   They age out on their own 60-day retention instead.
 * - `debugOwnerId` / `pairedAdminUserId` use 'set null': the event survives, the
 *   attribution to a since-deleted admin does not.
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
