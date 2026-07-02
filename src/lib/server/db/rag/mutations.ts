import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../index';
import { chunk, document } from '../schema/rag';

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
