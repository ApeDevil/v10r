import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../index';
import { chunk, collection, collectionDocument, document } from '../schema/rag';

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
	await db.insert(collectionDocument).values({ collectionId, documentId }).onConflictDoNothing();
}
