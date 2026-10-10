import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../index';
import { chunk, document } from '../schema/retrieval';

/** Soft-delete a document and hard-delete its chunks (removes from HNSW index). */
export async function deleteDocument(id: string, userId: string): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(document)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(and(eq(document.id, id), eq(document.userId, userId), isNull(document.deletedAt)))
			.returning({ id: document.id });

		if (updated) {
			await tx.delete(chunk).where(eq(chunk.documentId, id));
		}

		return !!updated;
	});
}

/**
 * Re-stamp a document whose derivation key still matches its source: the stored copy was
 * verified current now, so readers that compare index time to the source's edit time must
 * not report it as stale. Content and chunks are untouched.
 */
export async function markDocumentCurrent(id: string, userId: string): Promise<void> {
	await db
		.update(document)
		.set({ updatedAt: new Date() })
		.where(and(eq(document.id, id), eq(document.userId, userId), isNull(document.deletedAt)));
}
