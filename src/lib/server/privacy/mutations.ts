/**
 * GDPR Art 17 erasure — one canonical definition of "delete everything".
 *
 * Deleting the auth.user row IS the relational erasure: nearly every user-keyed
 * table references it with onDelete: 'cascade' (sessions, accounts, preferences,
 * conversations, desk, notification links, palettes, RAG documents+chunks). Idempotent.
 *
 * FOUR tables do NOT cascade, and each is handled explicitly inside one transaction
 * before the user row goes — a bare DELETE raises 23503 → 500 for any user who ever
 * wrote a post, issued a grant, or commented:
 *
 * - `blog.post.author_id` (RESTRICT) → REASSIGNED to another configured admin.
 *   Published writing is not the erasing user's personal data alone; the article
 *   survives with a new owner.
 * - `auth.grant.granted_by` (RESTRICT) → REASSIGNED likewise. The grant is a record
 *   of an administrative act on a THIRD party's account; erasing it would revoke
 *   someone else's capability.
 * - `blog.comment.author_id` (RESTRICT — it does NOT cascade) → HARD-DELETED. A
 *   comment is the user's own speech under their own name, so Art 17 takes it.
 * - `rag.llmwiki_page_source.document_id` / `.chunk_id` (RESTRICT) → the user's page
 *   sources are deleted explicitly FIRST. This one looks self-solving and is not:
 *   `llmwiki_page` cascades from user and `llmwiki_page_source` cascades from the page,
 *   so the junction rows DO go — but Postgres evaluates a RESTRICT the instant the
 *   referenced row is deleted rather than deferring it to the end of the cascade, and
 *   the same user delete also cascades into `document`→`chunk`. Whichever branch
 *   Postgres walks first wins: observed failure is `document_id` (23503), before the
 *   junction's own cascade has run. Delete order is load-bearing; hence the pre-delete.
 *
 * Reassignment needs a destination. When the erasing user is the ONLY configured
 * admin there is nobody to hand the rows to, and silently deleting a third party's
 * grant is not an option — the erasure is refused with SoleAdminBlockedError
 * (surfaced as 409, not 500) until another admin is configured.
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
import { eq, inArray } from 'drizzle-orm';
import { getAdminUserIds } from '$lib/server/auth/admin-ids';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { grant } from '$lib/server/db/schema/auth/grant';
import { comment } from '$lib/server/db/schema/blog/comment';
import { post } from '$lib/server/db/schema/blog/post';
import { llmwikiPage } from '$lib/server/db/schema/rag/llmwiki-page';
import { llmwikiPageSource } from '$lib/server/db/schema/rag/llmwiki-page-source';
import { imageAsset } from '$lib/server/db/schema/showcase/image-metadata';
import { deleteUserGraph } from '$lib/server/graph/rag/mutations';
import { BUCKET, s3 } from '$lib/server/store';
import { deleteImagemetaObject } from '$lib/server/store/showcase/image';

/**
 * Erasure refused: the user is the only configured admin AND owns rows that must be
 * reassigned rather than destroyed. Thrown from inside the transaction, so nothing is
 * deleted. Call sites map this to 409 — it is a resolvable configuration state, not a bug.
 */
export class SoleAdminBlockedError extends Error {
	readonly code = 'sole_admin_blocked';

	constructor(
		message = 'Cannot erase the last configured admin while blog posts or grants reference them. Add another admin to ADMIN_USER_ID first.',
	) {
		super(message);
		this.name = 'SoleAdminBlockedError';
	}
}

/**
 * Delete the user's R2 objects.
 *
 * MUST run BEFORE the user delete: `image.asset` cascades on user delete, so once
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
				await deleteImagemetaObject(storageKey);
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

	// Never hand the rows to the user being erased — that would re-create the FK we are
	// clearing. `find` also gives us the first-listed admin, the canonical system author.
	const reassignTo = getAdminUserIds().find((id) => id !== userId) ?? null;

	await db.transaction(async (tx) => {
		if (reassignTo) {
			await tx.update(post).set({ authorId: reassignTo }).where(eq(post.authorId, userId));
			await tx.update(grant).set({ grantedBy: reassignTo }).where(eq(grant.grantedBy, userId));
		} else {
			// Sole (or unconfigured) admin: erasure is only legal if nothing references them.
			// Two cheap existence probes rather than counts — we only need "any".
			const [blockingPost] = await tx.select({ id: post.id }).from(post).where(eq(post.authorId, userId)).limit(1);
			const [blockingGrant] = await tx.select({ id: grant.id }).from(grant).where(eq(grant.grantedBy, userId)).limit(1);
			if (blockingPost || blockingGrant) throw new SoleAdminBlockedError();
		}

		// The user's own speech — RESTRICT, so it must go explicitly. GDPR-correct: hard delete.
		await tx.delete(comment).where(eq(comment.authorId, userId));

		// Break the llmwiki junction's RESTRICT before the user cascade reaches document/chunk.
		const pages = await tx.select({ id: llmwikiPage.id }).from(llmwikiPage).where(eq(llmwikiPage.userId, userId));
		if (pages.length > 0) {
			await tx.delete(llmwikiPageSource).where(
				inArray(
					llmwikiPageSource.llmwikiPageId,
					pages.map((p) => p.id),
				),
			);
		}

		await tx.delete(user).where(eq(user.id, userId));
	});

	try {
		await deleteUserGraph(userId);
	} catch (err) {
		console.error('[privacy] Neo4j graph sweep failed during user erasure:', err instanceof Error ? err.message : err);
	}
}
