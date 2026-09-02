/**
 * Comment read paths — list with cursor pagination + cross-locale counts.
 */

import { and, count, desc, eq, isNull, lt, or, type SQL, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { comment } from '$lib/server/db/schema/blog/comment';
import type { CommentStatus } from '$lib/types/db-enums';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface PublicComment {
	id: string;
	postId: string;
	locale: string;
	authorId: string;
	authorName: string;
	body: string;
	status: CommentStatus;
	createdAt: string;
	editedAt: string | null;
}

interface ListParams {
	postId: string;
	locale: string;
	cursor?: string;
	limit?: number;
	/** Caller's userId — controls visibility of hidden comments to their author. */
	viewerId?: string;
	/** True when the caller is admin — they see hidden + removed too. */
	includeHidden?: boolean;
}

interface ListResult {
	items: PublicComment[];
	nextCursor: string | null;
	crossLocaleTotals: Record<string, number>;
}

function encodeCursor(createdAt: Date, id: string): string {
	return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), i: id })).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
	try {
		const obj = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as { t: string; i: string };
		return { createdAt: new Date(obj.t), id: obj.i };
	} catch {
		return null;
	}
}

/**
 * List visible comments on a (postId, locale) thread with cursor pagination.
 * Also returns crossLocaleTotals for the per-locale badge.
 *
 * Visibility:
 * - Public viewer: status='visible' only (hidden comments fully absent).
 * - Signed-in viewer: their own hidden/removed comments are included with
 *   status preserved so the UI can render the muted "moderated" state.
 * - Admin (includeHidden): everything.
 */
export async function listComments(params: ListParams): Promise<ListResult> {
	const { postId, locale, cursor, viewerId, includeHidden } = params;
	const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

	const conds: (SQL | undefined)[] = [
		eq(comment.postId, postId),
		eq(comment.locale, locale),
		isNull(comment.deletedAt),
	];

	if (!includeHidden) {
		if (viewerId) {
			// visible OR (own AND any status)
			conds.push(or(eq(comment.status, 'visible'), eq(comment.authorId, viewerId)));
		} else {
			conds.push(eq(comment.status, 'visible'));
		}
	}

	if (cursor) {
		const decoded = decodeCursor(cursor);
		if (decoded) {
			// (created_at < t) OR (created_at = t AND id < i)
			conds.push(
				or(
					lt(comment.createdAt, decoded.createdAt),
					and(eq(comment.createdAt, decoded.createdAt), lt(comment.id, decoded.id)),
				),
			);
		}
	}

	const rows = await db
		.select({
			id: comment.id,
			postId: comment.postId,
			locale: comment.locale,
			authorId: comment.authorId,
			authorName: user.name,
			body: comment.body,
			status: comment.status,
			createdAt: comment.createdAt,
			editedAt: comment.editedAt,
		})
		.from(comment)
		.innerJoin(user, eq(comment.authorId, user.id))
		.where(and(...conds))
		.orderBy(desc(comment.createdAt), desc(comment.id))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const items = (hasMore ? rows.slice(0, limit) : rows).map(
		(r): PublicComment => ({
			id: r.id,
			postId: r.postId,
			locale: r.locale,
			authorId: r.authorId,
			authorName: r.authorName,
			body: r.body,
			status: r.status,
			createdAt: r.createdAt.toISOString(),
			editedAt: r.editedAt?.toISOString() ?? null,
		}),
	);

	const last = items[items.length - 1];
	const nextCursor = hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null;

	// Cross-locale totals: one GROUP BY locale query.
	const totalsRows = await db
		.select({ locale: comment.locale, count: sql<number>`count(*)::int` })
		.from(comment)
		.where(and(eq(comment.postId, postId), eq(comment.status, 'visible'), isNull(comment.deletedAt)))
		.groupBy(comment.locale);

	const crossLocaleTotals: Record<string, number> = {};
	for (const row of totalsRows) crossLocaleTotals[row.locale] = row.count;

	return { items, nextCursor, crossLocaleTotals };
}

/**
 * Admin moderation queue — paginated list filtered by status/post/search.
 */
interface ModerationListParams {
	status?: CommentStatus | 'all';
	postId?: string;
	q?: string;
	page?: number;
	pageSize?: number;
}

export async function listForModeration(params: ModerationListParams = {}) {
	const pageSize = Math.min(params.pageSize ?? 25, 100);
	const page = Math.max(1, params.page ?? 1);
	const offset = (page - 1) * pageSize;

	const conds = [isNull(comment.deletedAt)];
	if (params.status && params.status !== 'all') conds.push(eq(comment.status, params.status));
	if (params.postId) conds.push(eq(comment.postId, params.postId));
	if (params.q) conds.push(sql`${comment.body} ILIKE ${`%${params.q}%`}`);

	const where = and(...conds);

	const [rows, totalRows] = await Promise.all([
		db
			.select({
				id: comment.id,
				postId: comment.postId,
				locale: comment.locale,
				authorId: comment.authorId,
				authorEmail: user.email,
				body: comment.body,
				status: comment.status,
				createdAt: comment.createdAt,
				hiddenAt: comment.hiddenAt,
				hiddenBy: comment.hiddenBy,
				hiddenReason: comment.hiddenReason,
			})
			.from(comment)
			.innerJoin(user, eq(comment.authorId, user.id))
			.where(where)
			.orderBy(desc(comment.createdAt))
			.limit(pageSize)
			.offset(offset),
		db.select({ total: count() }).from(comment).where(where),
	]);

	const total = totalRows[0]?.total ?? 0;
	return { items: rows, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
