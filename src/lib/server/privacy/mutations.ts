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

import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { imageAsset } from '$lib/server/db/schema/showcase/image-metadata';
import { deleteUser } from '$lib/server/db/user';
import { deleteUserGraph } from '$lib/server/graph/rag/mutations';
import { BUCKET, s3 } from '$lib/server/store';
import { deleteImageObject } from '$lib/server/store/showcase/image';

/**
 * Delete the user's R2 objects.
 *
 * MUST run BEFORE deleteUser(): `image.asset` cascades on user delete, so once
 * the rows are gone the storage keys are unrecoverable and every object is
 * orphaned in the bucket forever — erasure that leaves the actual images behind.
 *
 * Best-effort, like the Neo4j sweep: an R2 outage must not block the
 * authoritative relational erasure. Failures are logged, never thrown.
 *
 * Blog assets are deliberately NOT swept — `blog.asset.uploader_id` is
 * `SET NULL`, so those rows outlive the uploader by design.
 */
async function sweepUserObjects(userId: string): Promise<void> {
	try {
		const rows = await db
			.select({ storageKey: imageAsset.storageKey })
			.from(imageAsset)
			.where(eq(imageAsset.userId, userId));

		for (const { storageKey } of rows) {
			try {
				await deleteImageObject(storageKey);
			} catch (err) {
				console.error('[privacy] R2 image delete failed:', storageKey, err instanceof Error ? err.message : err);
			}
		}
	} catch (err) {
		console.error('[privacy] R2 image sweep failed:', err instanceof Error ? err.message : err);
	}

	// Avatar keys are derived, not stored in their own table — read the current
	// pointer off the user row while it still exists.
	try {
		const [row] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId)).limit(1);
		if (s3 && row?.image?.startsWith('/avatars/')) {
			await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: row.image.slice(1) }));
		}
	} catch (err) {
		console.error('[privacy] R2 avatar delete failed:', err instanceof Error ? err.message : err);
	}
}

export async function deleteUserData(userId: string): Promise<void> {
	// Order matters: object keys live in rows that the cascade is about to erase.
	await sweepUserObjects(userId);

	await deleteUser(userId);
	try {
		await deleteUserGraph(userId);
	} catch (err) {
		console.error('[privacy] Neo4j graph sweep failed during user erasure:', err instanceof Error ? err.message : err);
	}
}
