/**
 * Comment write paths — single domain function per operation, called from
 * both the sub-route form action and the REST endpoint.
 */
import { and, eq, sql } from 'drizzle-orm';
import { recordAuditEvent } from '$lib/server/admin/audit';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { comment } from '$lib/server/db/schema/blog/comment';
import { post } from '$lib/server/db/schema/blog/post';
import { publishedRevision } from '$lib/server/db/schema/blog/published-revision';
import type { CreateCommentInput, EditCommentInput } from './schemas';

const EDIT_WINDOW_MS = 5 * 60 * 1000;

export class CommentOnUnpublishedError extends Error {
	readonly code = 'comment_on_unpublished' as const;
	constructor() {
		super('Post is not published in this locale');
	}
}

export class CommentNotFoundError extends Error {
	readonly code = 'not_found' as const;
	constructor() {
		super('Comment not found');
	}
}

export class CommentNotOwnedError extends Error {
	readonly code = 'forbidden' as const;
	constructor() {
		super('You do not own this comment');
	}
}

export class CommentEditWindowExpiredError extends Error {
	readonly code = 'comment_edit_window_expired' as const;
	constructor() {
		super('Edit window has expired');
	}
}

export class CommentHiddenError extends Error {
	readonly code = 'comment_hidden' as const;
	constructor() {
		super('Cannot mutate a hidden comment');
	}
}

interface CreateParams extends CreateCommentInput {
	postId: string;
	authorId: string;
}

interface CreateResult {
	id: string;
	idempotentReplay: boolean;
}

/**
 * Create a comment. Idempotent via UNIQUE (author_id, post_id, client_nonce):
 * a retry with the same nonce returns the original row with idempotentReplay=true.
 */
export async function createComment(params: CreateParams): Promise<CreateResult> {
	const { postId, locale, body, clientNonce, authorId } = params;

	// Check the locale is published. The FK would also catch this, but we want
	// a typed error code (comment_on_unpublished) not a raw FK violation.
	const published = await db
		.select({ postId: publishedRevision.postId })
		.from(publishedRevision)
		.where(and(eq(publishedRevision.postId, postId), eq(publishedRevision.locale, locale)))
		.limit(1);

	if (published.length === 0) {
		throw new CommentOnUnpublishedError();
	}

	// Idempotent insert: ON CONFLICT (author_id, post_id, client_nonce) DO NOTHING.
	const inserted = await db
		.insert(comment)
		.values({
			id: createId.comment(),
			postId,
			locale,
			authorId,
			body,
			clientNonce,
		})
		.onConflictDoNothing({ target: [comment.authorId, comment.postId, comment.clientNonce] })
		.returning({ id: comment.id });

	if (inserted[0]) return { id: inserted[0].id, idempotentReplay: false };

	// Conflict — fetch the original row.
	const existing = await db
		.select({ id: comment.id })
		.from(comment)
		.where(and(eq(comment.authorId, authorId), eq(comment.postId, postId), eq(comment.clientNonce, clientNonce)))
		.limit(1);

	if (!existing[0]) {
		throw new Error('Idempotent replay lookup failed unexpectedly');
	}
	return { id: existing[0].id, idempotentReplay: true };
}

interface EditOwnParams extends EditCommentInput {
	commentId: string;
	authorId: string;
}

export async function editOwnComment(params: EditOwnParams): Promise<void> {
	const { commentId, authorId, body } = params;

	const rows = await db
		.select({
			authorId: comment.authorId,
			status: comment.status,
			deletedAt: comment.deletedAt,
			createdAt: comment.createdAt,
		})
		.from(comment)
		.where(eq(comment.id, commentId))
		.limit(1);

	const row = rows[0];
	if (!row || row.deletedAt) throw new CommentNotFoundError();
	if (row.authorId !== authorId) throw new CommentNotOwnedError();
	if (row.status !== 'visible') throw new CommentHiddenError();
	if (Date.now() - row.createdAt.getTime() > EDIT_WINDOW_MS) {
		throw new CommentEditWindowExpiredError();
	}

	await db.update(comment).set({ body, editedAt: new Date() }).where(eq(comment.id, commentId));
}

interface SoftDeleteOwnParams {
	commentId: string;
	authorId: string;
}

export async function softDeleteOwnComment(params: SoftDeleteOwnParams): Promise<void> {
	const { commentId, authorId } = params;

	const rows = await db
		.select({ authorId: comment.authorId, deletedAt: comment.deletedAt })
		.from(comment)
		.where(eq(comment.id, commentId))
		.limit(1);

	const row = rows[0];
	if (!row || row.deletedAt) throw new CommentNotFoundError();
	if (row.authorId !== authorId) throw new CommentNotOwnedError();

	await db.update(comment).set({ deletedAt: new Date() }).where(eq(comment.id, commentId));
}

interface ModerateParams {
	commentId: string;
	actor: { id: string; email: string };
	reason?: string;
	ipAddress?: string | null;
}

export async function hideComment(params: ModerateParams): Promise<void> {
	const { commentId, actor, reason, ipAddress } = params;

	const updated = await db
		.update(comment)
		.set({ status: 'hidden', hiddenBy: actor.id, hiddenAt: new Date(), hiddenReason: reason ?? null })
		.where(eq(comment.id, commentId))
		.returning({ id: comment.id });

	if (updated.length === 0) throw new CommentNotFoundError();

	await recordAuditEvent({
		actorId: actor.id,
		actorEmail: actor.email,
		action: 'blog.comment.hide',
		targetType: 'blog.comment',
		targetId: commentId,
		detail: reason ? { reason } : undefined,
		ipAddress: ipAddress ?? undefined,
	});
}

export async function unhideComment(params: ModerateParams): Promise<void> {
	const { commentId, actor, ipAddress } = params;

	const updated = await db
		.update(comment)
		.set({ status: 'visible', hiddenBy: null, hiddenAt: null, hiddenReason: null })
		.where(eq(comment.id, commentId))
		.returning({ id: comment.id });

	if (updated.length === 0) throw new CommentNotFoundError();

	await recordAuditEvent({
		actorId: actor.id,
		actorEmail: actor.email,
		action: 'blog.comment.unhide',
		targetType: 'blog.comment',
		targetId: commentId,
		ipAddress: ipAddress ?? undefined,
	});
}

export async function removeComment(params: ModerateParams): Promise<void> {
	const { commentId, actor, reason, ipAddress } = params;

	const updated = await db
		.update(comment)
		.set({
			status: 'removed',
			body: '[removed]',
			hiddenBy: actor.id,
			hiddenAt: new Date(),
			hiddenReason: reason ?? null,
		})
		.where(eq(comment.id, commentId))
		.returning({ id: comment.id });

	if (updated.length === 0) throw new CommentNotFoundError();

	await recordAuditEvent({
		actorId: actor.id,
		actorEmail: actor.email,
		action: 'blog.comment.remove',
		targetType: 'blog.comment',
		targetId: commentId,
		detail: reason ? { reason } : undefined,
		ipAddress: ipAddress ?? undefined,
	});
}

/** Resolve a post by slug for the form action — returns id or null. */
export async function getPostIdBySlug(slug: string): Promise<string | null> {
	const rows = await db
		.select({ id: post.id })
		.from(post)
		.where(and(eq(post.slug, slug), sql`${post.deletedAt} IS NULL`))
		.limit(1);
	return rows[0]?.id ?? null;
}
