import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../index';
import { document } from '../schema/retrieval';

/** List documents for a user (active only, newest first). */
export async function listDocuments(userId: string, offset = 0, limit = 50) {
	const where = and(eq(document.userId, userId), isNull(document.deletedAt));
	const [items, [countResult]] = await Promise.all([
		db
			.select({
				id: document.id,
				title: document.title,
				source: document.source,
				status: document.status,
				totalChunks: document.totalChunks,
				totalTokens: document.totalTokens,
				createdAt: document.createdAt,
			})
			.from(document)
			.where(where)
			.orderBy(desc(document.createdAt))
			.offset(offset)
			.limit(limit),
		db.select({ total: count() }).from(document).where(where),
	]);
	return { items, total: countResult?.total ?? 0 };
}

/**
 * Find a user's active document by its `sourceUri` back-pointer (e.g. `desk_file_<id>`).
 * Used by the deskbot retrieval sync to locate the retrieval copy of a desk file for re-ingest.
 */
export async function getDocumentBySourcePath(sourceUri: string, userId: string) {
	const [row] = await db
		.select({ id: document.id, updatedAt: document.updatedAt, contentHash: document.contentHash })
		.from(document)
		.where(and(eq(document.sourceUri, sourceUri), eq(document.userId, userId), isNull(document.deletedAt)))
		.limit(1);
	return row ?? null;
}

/** List all active `source = 'desk'` documents (the deskbot corpus) for sync reconciliation. */
export async function listDeskRetrievalDocs() {
	return db
		.select({ id: document.id, userId: document.userId, sourceUri: document.sourceUri })
		.from(document)
		.where(and(eq(document.source, 'desk'), isNull(document.deletedAt)));
}

/** Get a single document with ownership check. */
export async function getDocument(id: string, userId: string) {
	const [doc] = await db
		.select()
		.from(document)
		.where(and(eq(document.id, id), eq(document.userId, userId), isNull(document.deletedAt)))
		.limit(1);
	return doc ?? null;
}

/** Count active documents for a user. */
export async function countDocuments(userId: string): Promise<number> {
	const [result] = await db
		.select({ total: count() })
		.from(document)
		.where(and(eq(document.userId, userId), isNull(document.deletedAt)));
	return result?.total ?? 0;
}

/**
 * Searchable corpus size for one owner, optionally narrowed to one source kind —
 * the context-probe's "available" side. Counts only `ready` documents (those
 * whose chunks are embedded and therefore retrievable).
 */
export async function countCorpus(
	userId: string,
	source?: 'upload' | 'web' | 'text' | 'api' | 'catalog' | 'docs' | 'desk',
): Promise<{ documents: number; chunks: number }> {
	const [row] = await db
		.select({
			documents: count(),
			chunks: sql<number>`coalesce(sum(${document.totalChunks}), 0)::int`,
		})
		.from(document)
		.where(
			and(
				eq(document.userId, userId),
				eq(document.status, 'ready'),
				isNull(document.deletedAt),
				source ? eq(document.source, source) : undefined,
			),
		);
	return { documents: row?.documents ?? 0, chunks: row?.chunks ?? 0 };
}
