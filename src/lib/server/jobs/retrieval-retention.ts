import { and, isNotNull, lt } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { document } from '#lib/server/db/schema/retrieval/index.ts';
import { retentionCutoff } from '#lib/server/retention/index.ts';

/**
 * Empty the retrieval trash: hard-delete documents soft-deleted longer ago than the
 * `retrieval-trash` window. Their chunks — embeddings, the bulk of the bytes — go with them
 * by FK `ON DELETE CASCADE`, so a tombstone whose chunks an older ingest left behind is
 * repaired here too. A live document (`deleted_at IS NULL`) is never a candidate.
 *
 * Returns the documents deleted.
 */
export async function retrievalRetention(): Promise<number> {
	const cutoff = retentionCutoff('retrieval-trash');

	const deleted = await db
		.delete(document)
		.where(and(isNotNull(document.deletedAt), lt(document.deletedAt, cutoff)))
		.returning({ id: document.id });

	return deleted.length;
}
