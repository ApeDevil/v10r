import { eq, and, desc, isNull, count } from 'drizzle-orm';
import { db } from '../index';
import { document, chunk, collection, collectionDocument } from '../schema/rag';

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

/** Soft-delete a document and hard-delete its chunks (removes from HNSW index). */
export async function deleteDocument(id: string, userId: string): Promise<boolean> {
	const [updated] = await db
		.update(document)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(document.id, id), eq(document.userId, userId), isNull(document.deletedAt)))
		.returning({ id: document.id });

	if (updated) {
		await db.delete(chunk).where(eq(chunk.documentId, id));
	}

	return !!updated;
}

/** Count active documents for a user. */
export async function countDocuments(userId: string): Promise<number> {
	const [result] = await db
		.select({ total: count() })
		.from(document)
		.where(and(eq(document.userId, userId), isNull(document.deletedAt)));
	return result?.total ?? 0;
}

/** Create a collection. */
export async function createCollection(userId: string, name: string, description?: string) {
	const [row] = await db
		.insert(collection)
		.values({
			id: `col_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
			userId,
			name,
			description: description ?? null,
		})
		.returning();
	return row;
}

/** Add a document to a collection. */
export async function addDocumentToCollection(collectionId: string, documentId: string) {
	await db
		.insert(collectionDocument)
		.values({ collectionId, documentId })
		.onConflictDoNothing();
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
		.orderBy(desc(collection.createdAt));
}
