import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../index';
import { corpusMap, document } from '../schema/retrieval';

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

/**
 * The origin and index time of the documents behind a set of retrieved chunks — what lets
 * `desk_search_knowledge` cite the desk file a chunk came from and say how fresh the copy is.
 */
export async function listDocumentOrigins(ids: string[], userId: string) {
	if (ids.length === 0) return [];
	return db
		.select({ id: document.id, sourceUri: document.sourceUri, updatedAt: document.updatedAt })
		.from(document)
		.where(and(inArray(document.id, ids), eq(document.userId, userId)));
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
 * the profile manifest's grounding inventory. Counts only `ready` documents (those
 * whose chunks are embedded and therefore retrievable).
 */
/**
 * Whether a user's desk corpus can answer a search right now: nothing opted into AI
 * context (`none`), documents present but none searchable yet — the desk sync still has
 * them `pending`/`processing` (`indexing`) — or at least one `ready` document. A document
 * in `error` is as good as absent. One aggregate over the user's own rows; a desk holds a
 * handful, never a scan.
 */
export type DeskCorpusState = 'none' | 'indexing' | 'ready';

export async function deskCorpusState(userId: string): Promise<DeskCorpusState> {
	const [row] = await db
		.select({
			ready: sql<boolean>`coalesce(bool_or(${document.status} = 'ready'), false)`,
			indexing: sql<boolean>`coalesce(bool_or(${document.status} in ('pending', 'processing')), false)`,
		})
		.from(document)
		.where(and(eq(document.userId, userId), eq(document.source, 'desk'), isNull(document.deletedAt)));
	if (row?.ready) return 'ready';
	return row?.indexing ? 'indexing' : 'none';
}

export async function countCorpus(
	userId: string,
	source?: 'upload' | 'web' | 'text' | 'api' | 'docs' | 'desk',
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

/** A corpus map as a prompt or an inspector reads it. */
export interface CorpusMapRow {
	id: string;
	title: string;
	body: string;
	builtAt: Date;
}

/**
 * The map of one collection's corpus, for the owners the reader may see — `[user.id]` for
 * the user's own, `[SYSTEM_DOCS_USER_ID]` for the project docs. Scoping by owner set rather
 * than one user is what lets the chatbot inject the system map for a signed-in user.
 */
export async function getCorpusMap(ownerIds: string[], collectionId: string): Promise<CorpusMapRow | null> {
	const [row] = await db
		.select({ id: corpusMap.id, title: corpusMap.title, body: corpusMap.body, builtAt: corpusMap.builtAt })
		.from(corpusMap)
		.where(and(inArray(corpusMap.userId, ownerIds), eq(corpusMap.collectionId, collectionId)))
		.limit(1);
	return row ?? null;
}

/** Whether a collection has a map at all — the profile manifest's inventory, no body read. */
export async function countCorpusMaps(ownerIds: string[], collectionId: string): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(corpusMap)
		.where(and(inArray(corpusMap.userId, ownerIds), eq(corpusMap.collectionId, collectionId)));
	return row?.total ?? 0;
}
