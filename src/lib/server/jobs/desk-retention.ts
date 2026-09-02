import { and, isNotNull, lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { file, fileRevision } from '$lib/server/db/schema/desk';
import { retentionCutoff } from '$lib/server/retention';

/**
 * Sweep soft-deleted desk content and prune stale revisions — the retention job the
 * `deleteFile` mutation's "stays until a retention sweep runs" comment referred to.
 *
 *   - `file`: hard-deleted once the `desk-trash` window elapses after soft-delete. Its
 *     `spreadsheet` / `markdown` detail row is removed by FK `ON DELETE CASCADE`.
 *   - `file_revision`: the undo/version trail has no FK to `file`, so the `desk-revisions`
 *     rule age-caps it independently.
 *
 * Returns the total rows deleted (files + revisions).
 */
export async function deskRetention(): Promise<number> {
	const fileCutoff = retentionCutoff('desk-trash');
	const revisionCutoff = retentionCutoff('desk-revisions');

	const deletedFiles = await db
		.delete(file)
		.where(and(isNotNull(file.deletedAt), lt(file.deletedAt, fileCutoff)))
		.returning({ id: file.id });

	const deletedRevisions = await db
		.delete(fileRevision)
		.where(lt(fileRevision.createdAt, revisionCutoff))
		.returning({ id: fileRevision.id });

	return deletedFiles.length + deletedRevisions.length;
}
