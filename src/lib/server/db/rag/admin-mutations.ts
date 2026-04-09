import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../index';
import { chunk, document } from '../schema/rag';

/** Soft-delete a document and hard-delete its chunks (admin — no userId scope). */
export async function adminDeleteDocument(documentId: string) {
	const [doc] = await db
		.update(document)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(document.id, documentId), isNull(document.deletedAt)))
		.returning({ id: document.id, title: document.title });

	if (doc) {
		await db.delete(chunk).where(eq(chunk.documentId, documentId));
	}

	return doc ?? null;
}

/** Reset a document's error state so it can be retried (admin — no userId scope). */
export async function adminResetDocument(documentId: string) {
	const [doc] = await db
		.update(document)
		.set({
			status: 'pending',
			errorMessage: null,
			totalChunks: 0,
			totalTokens: 0,
			updatedAt: new Date(),
		})
		.where(and(eq(document.id, documentId), isNull(document.deletedAt)))
		.returning({ id: document.id, title: document.title, status: document.status });

	return doc ?? null;
}
