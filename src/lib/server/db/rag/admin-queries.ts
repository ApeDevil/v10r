import { count, desc, eq, isNull, sql, sum } from 'drizzle-orm';
import { db } from '../index';
import { chunk, collection, collectionDocument, document } from '../schema/rag';
import { user } from '../schema/auth/_better-auth';
import { ADMIN_RAG_PAGE_SIZE } from '$lib/server/config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RAGOverviewStats {
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
	documentCount: number;
	createdAt: Date;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getRAGOverviewStats(): Promise<RAGOverviewStats> {
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
}): Promise<{ entries: DocumentAdminView[]; total: number; totalPages: number }> {
	const { status, page } = filters;
	const offset = (page - 1) * ADMIN_RAG_PAGE_SIZE;

	const conditions = [isNull(document.deletedAt)];
	if (status && ['pending', 'processing', 'ready', 'error'].includes(status)) {
		conditions.push(eq(document.status, status as 'pending' | 'processing' | 'ready' | 'error'));
	}

	const where = conditions.length > 1
		? sql`${conditions[0]} AND ${conditions[1]}`
		: conditions[0];

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
			.limit(ADMIN_RAG_PAGE_SIZE)
			.offset(offset),
		db.select({ total: count() }).from(document).where(where),
	]);

	const total = totalResult[0]?.total ?? 0;

	return {
		entries,
		total,
		totalPages: Math.max(1, Math.ceil(total / ADMIN_RAG_PAGE_SIZE)),
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
			documentCount: sql<number>`(
				SELECT count(*) FROM rag.collection_document cd
				WHERE cd.collection_id = ${collection.id}
			)`,
			createdAt: collection.createdAt,
		})
		.from(collection)
		.innerJoin(user, eq(collection.userId, user.id))
		.where(isNull(collection.deletedAt))
		.orderBy(desc(collection.createdAt));

	return rows.map((r) => ({ ...r, documentCount: Number(r.documentCount) }));
}
