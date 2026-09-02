import { count, desc, eq, isNull, sql, sum } from 'drizzle-orm';
import { db } from '../index';
import { user } from '../schema/auth/_better-auth';
import { chunk, collection, document } from '../schema/retrieval';

export interface RetrievalOverviewStats {
	totalDocuments: number;
	pendingCount: number;
	processingCount: number;
	readyCount: number;
	errorCount: number;
	totalChunks: number;
	totalTokens: number;
	totalCollections: number;
}

export interface DocumentAdminView {
	id: string;
	title: string;
	source: string;
	status: string;
	totalChunks: number;
	totalTokens: number;
	errorMessage: string | null;
	userId: string | null;
	userEmail: string | null;
	createdAt: Date;
}

export interface CollectionAdminView {
	id: string;
	name: string;
	description: string | null;
	userId: string;
	userEmail: string;
	createdAt: Date;
}

export async function getRetrievalOverviewStats(): Promise<RetrievalOverviewStats> {
	const [docStats, chunkStats, collCount] = await Promise.all([
		db
			.select({
				total: count(),
				pendingCount: sql<number>`count(*) FILTER (WHERE ${document.status} = 'pending')`,
				processingCount: sql<number>`count(*) FILTER (WHERE ${document.status} = 'processing')`,
				readyCount: sql<number>`count(*) FILTER (WHERE ${document.status} = 'ready')`,
				errorCount: sql<number>`count(*) FILTER (WHERE ${document.status} = 'error')`,
				totalChunksSum: sum(document.totalChunks),
				totalTokensSum: sum(document.totalTokens),
			})
			.from(document)
			.where(isNull(document.deletedAt)),
		db.select({ total: count() }).from(chunk),
		db.select({ total: count() }).from(collection).where(isNull(collection.deletedAt)),
	]);

	const ds = docStats[0];
	return {
		totalDocuments: ds?.total ?? 0,
		pendingCount: Number(ds?.pendingCount ?? 0),
		processingCount: Number(ds?.processingCount ?? 0),
		readyCount: Number(ds?.readyCount ?? 0),
		errorCount: Number(ds?.errorCount ?? 0),
		totalChunks: chunkStats[0]?.total ?? 0,
		totalTokens: Number(ds?.totalTokensSum ?? 0),
		totalCollections: collCount[0]?.total ?? 0,
	};
}

export async function getDocumentsAdmin(filters: {
	status?: string;
	page: number;
	pageSize: number;
}): Promise<{ entries: DocumentAdminView[]; total: number; totalPages: number }> {
	const { status, page, pageSize } = filters;
	const offset = (page - 1) * pageSize;

	const conditions = [isNull(document.deletedAt)];
	if (status && ['pending', 'processing', 'ready', 'error'].includes(status)) {
		conditions.push(eq(document.status, status as 'pending' | 'processing' | 'ready' | 'error'));
	}

	const where = conditions.length > 1 ? sql`${conditions[0]} AND ${conditions[1]}` : conditions[0];

	const [entries, totalResult] = await Promise.all([
		db
			.select({
				id: document.id,
				title: document.title,
				source: document.source,
				status: document.status,
				totalChunks: document.totalChunks,
				totalTokens: document.totalTokens,
				errorMessage: document.errorMessage,
				userId: document.userId,
				userEmail: user.email,
				createdAt: document.createdAt,
			})
			.from(document)
			.leftJoin(user, eq(document.userId, user.id))
			.where(where)
			.orderBy(desc(document.createdAt))
			.limit(pageSize)
			.offset(offset),
		db.select({ total: count() }).from(document).where(where),
	]);

	const total = totalResult[0]?.total ?? 0;

	return {
		entries,
		total,
		totalPages: Math.max(1, Math.ceil(total / pageSize)),
	};
}

export async function getErrorDocuments(): Promise<DocumentAdminView[]> {
	return db
		.select({
			id: document.id,
			title: document.title,
			source: document.source,
			status: document.status,
			totalChunks: document.totalChunks,
			totalTokens: document.totalTokens,
			errorMessage: document.errorMessage,
			userId: document.userId,
			userEmail: user.email,
			createdAt: document.createdAt,
		})
		.from(document)
		.leftJoin(user, eq(document.userId, user.id))
		.where(sql`${document.status} = 'error' AND ${document.deletedAt} IS NULL`)
		.orderBy(desc(document.createdAt))
		.limit(20);
}

export async function getCollectionsAdmin(): Promise<CollectionAdminView[]> {
	const rows = await db
		.select({
			id: collection.id,
			name: collection.name,
			description: collection.description,
			userId: collection.userId,
			userEmail: user.email,
			createdAt: collection.createdAt,
		})
		.from(collection)
		.innerJoin(user, eq(collection.userId, user.id))
		.where(isNull(collection.deletedAt))
		.orderBy(desc(collection.createdAt));

	return rows;
}

export interface DocumentsBySource {
	source: string;
	count: number;
}

/** Document counts grouped by `documentSourceEnum` — feeds the pipeline diagram's
 *  docs-corpus (source='docs') and catalog (source='catalog') node badges. */
export async function getDocumentsBySource(): Promise<DocumentsBySource[]> {
	const rows = await db
		.select({ source: document.source, n: count() })
		.from(document)
		.where(isNull(document.deletedAt))
		.groupBy(document.source);
	return rows.map((r) => ({ source: r.source, count: Number(r.n) }));
}

export interface ChunkCoverage {
	totalChunks: number;
	embeddedChunks: number;
	byLevel: Record<string, number>;
}

/** Embedding + tier coverage over `retrieval.chunk` — live read-time counts (no cache). */
export async function getChunkCoverage(): Promise<ChunkCoverage> {
	const [cov, byLevel] = await Promise.all([
		db
			.select({
				total: count(),
				embedded: sql<number>`count(*) FILTER (WHERE ${chunk.embedding} IS NOT NULL)`,
			})
			.from(chunk),
		db.select({ level: chunk.level, n: count() }).from(chunk).groupBy(chunk.level),
	]);

	const byLevelRec: Record<string, number> = {};
	for (const r of byLevel) byLevelRec[r.level] = Number(r.n);

	return {
		totalChunks: cov[0]?.total ?? 0,
		embeddedChunks: Number(cov[0]?.embedded ?? 0),
		byLevel: byLevelRec,
	};
}
