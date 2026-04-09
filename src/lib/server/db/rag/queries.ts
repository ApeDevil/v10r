import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../index';
import { collection, document } from '../schema/rag';

/** List documents for a user (active only, newest first). */
export async function listDocuments(userId: string) {
	return db
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
		.where(and(eq(document.userId, userId), isNull(document.deletedAt)))
		.orderBy(desc(document.createdAt))
		.limit(100);
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

/** List collections for a user. */
export async function listCollections(userId: string) {
	return db
		.select({
			id: collection.id,
			name: collection.name,
			description: collection.description,
			createdAt: collection.createdAt,
		})
		.from(collection)
		.where(and(eq(collection.userId, userId), isNull(collection.deletedAt)))
		.orderBy(desc(collection.createdAt))
		.limit(100);
}
